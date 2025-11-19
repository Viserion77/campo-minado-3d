'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Configurações do jogo
const GRID_SIZE = 10
const CELL_SIZE = 1

// Dificuldades
const DIFFICULTIES = {
  easy: { name: 'Fácil', mines: 10, color: 'from-emerald-500 to-teal-600' },
  medium: { name: 'Médio', mines: 20, color: 'from-yellow-500 to-orange-600' },
  hard: { name: 'Difícil', mines: 30, color: 'from-red-500 to-pink-600' }
}

type Difficulty = keyof typeof DIFFICULTIES
type Position = { x: number; z: number }

// Componente do jogador
function Player({ position }: { position: Position }) {
  return (
    <mesh position={[position.x, 0.5, position.z]}>
      <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
      <meshStandardMaterial color="#4ade80" />
    </mesh>
  )
}

// Função para contar minas adjacentes
function countAdjacentMines(x: number, z: number, mines: Set<string>): number {
  let count = 0
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue
      const key = `${x + dx},${z + dz}`
      if (mines.has(key)) count++
    }
  }
  return count
}

// Componente de célula do chão
function Cell({ 
  x, 
  z, 
  isMine, 
  isRevealed, 
  adjacentMines,
  isExploded 
}: { 
  x: number
  z: number
  isMine: boolean
  isRevealed: boolean
  adjacentMines: number
  isExploded: boolean
}) {
  // Cores baseadas no número de minas adjacentes
  const getNumberColor = (count: number) => {
    const colors = [
      '#64748b', // 0
      '#3b82f6', // 1
      '#22c55e', // 2
      '#eab308', // 3
      '#f97316', // 4
      '#ef4444', // 5
      '#dc2626', // 6
      '#991b1b', // 7
      '#7f1d1d'  // 8
    ]
    return colors[count] || colors[0]
  }

  return (
    <group position={[x, 0, z]}>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CELL_SIZE * 0.95, CELL_SIZE * 0.95]} />
        <meshStandardMaterial 
          color={
            isExploded ? '#ef4444' : 
            isRevealed ? (isMine ? '#dc2626' : '#94a3b8') : 
            '#475569'
          } 
          opacity={isRevealed ? 1 : 0.6}
          transparent
        />
      </mesh>

      {/* Número de minas adjacentes (só mostra se revelado e não é mina) */}
      {isRevealed && !isMine && adjacentMines > 0 && (
        <Text
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color={getNumberColor(adjacentMines)}
          anchorX="center"
          anchorY="middle"
        >
          {adjacentMines.toString()}
        </Text>
      )}

      {/* Mina (só mostra se revelado e é mina) */}
      {isRevealed && isMine && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial 
            color={isExploded ? '#dc2626' : '#f59e0b'} 
            emissive={isExploded ? '#dc2626' : '#f59e0b'} 
            emissiveIntensity={0.5} 
          />
        </mesh>
      )}
    </group>
  )
}

// Componente principal do jogo 3D
function Game3D({ difficulty, onReset }: { difficulty: Difficulty; onReset: () => void }) {
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, z: Math.floor(GRID_SIZE / 2) - 1 })
  const [mines, setMines] = useState<Set<string>>(new Set())
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set())
  const [explodedMine, setExplodedMine] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [victory, setVictory] = useState(false)
  const keysPressed = useRef<Set<string>>(new Set())

  // Gerar minas aleatórias
  useEffect(() => {
    const mineCount = DIFFICULTIES[difficulty].mines
    const mineSet = new Set<string>()
    const startPos = `0,${Math.floor(GRID_SIZE / 2) - 1}`
    
    while (mineSet.size < mineCount) {
      const x = Math.floor(Math.random() * GRID_SIZE) - Math.floor(GRID_SIZE / 2)
      const z = Math.floor(Math.random() * GRID_SIZE) - Math.floor(GRID_SIZE / 2)
      const key = `${x},${z}`
      
      // Não colocar mina na posição inicial do jogador
      if (key !== startPos) {
        mineSet.add(key)
      }
    }
    setMines(mineSet)
    
    // Revelar célula inicial
    setRevealedCells(new Set([startPos]))
  }, [difficulty])

  // Controles de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase())
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Loop de movimento
  useEffect(() => {
    if (gameOver || victory) return

    const moveSpeed = 0.05
    const interval = setInterval(() => {
      setPlayerPos((prev) => {
        let newX = prev.x
        let newZ = prev.z

        if (keysPressed.current.has('w')) newZ -= moveSpeed
        if (keysPressed.current.has('s')) newZ += moveSpeed
        if (keysPressed.current.has('a')) newX -= moveSpeed
        if (keysPressed.current.has('d')) newX += moveSpeed

        // Limitar aos limites do grid
        const halfGrid = Math.floor(GRID_SIZE / 2)
        newX = Math.max(-halfGrid, Math.min(halfGrid - 1, newX))
        newZ = Math.max(-halfGrid, Math.min(halfGrid - 1, newZ))

        // Verificar célula atual (arredondar para célula mais próxima)
        const cellX = Math.round(newX)
        const cellZ = Math.round(newZ)
        const cellKey = `${cellX},${cellZ}`

        // Revelar célula onde o jogador está
        setRevealedCells((prev) => {
          if (!prev.has(cellKey)) {
            const newRevealed = new Set(prev)
            newRevealed.add(cellKey)
            return newRevealed
          }
          return prev
        })

        // Verificar colisão com mina (só se estiver bem próximo do centro da célula)
        const distanceToCenter = Math.sqrt(
          Math.pow(newX - cellX, 2) + Math.pow(newZ - cellZ, 2)
        )
        
        if (distanceToCenter < 0.3 && mines.has(cellKey)) {
          setExplodedMine(cellKey)
          setGameOver(true)
        }

        return { x: newX, z: newZ }
      })
    }, 16)

    return () => clearInterval(interval)
  }, [gameOver, victory, mines])

  // Verificar vitória (chegou ao outro lado)
  useEffect(() => {
    const halfGrid = Math.floor(GRID_SIZE / 2)
    if (playerPos.z <= -halfGrid + 0.5 && !gameOver) {
      setVictory(true)
    }
  }, [playerPos, gameOver])

  return (
    <>
      {/* Grid do chão */}
      {Array.from({ length: GRID_SIZE }).map((_, i) =>
        Array.from({ length: GRID_SIZE }).map((_, j) => {
          const x = i - Math.floor(GRID_SIZE / 2)
          const z = j - Math.floor(GRID_SIZE / 2)
          const cellKey = `${x},${z}`
          const isMine = mines.has(cellKey)
          const isRevealed = revealedCells.has(cellKey)
          const adjacentMines = countAdjacentMines(x, z, mines)
          const isExploded = cellKey === explodedMine

          return (
            <Cell
              key={cellKey}
              x={x}
              z={z}
              isMine={isMine}
              isRevealed={isRevealed}
              adjacentMines={adjacentMines}
              isExploded={isExploded}
            />
          )
        })
      )}

      {/* Jogador */}
      <Player position={playerPos} />

      {/* Luzes */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* Textos de status */}
      {gameOver && (
        <Text
          position={[0, 3, 0]}
          fontSize={0.8}
          color="#ef4444"
          anchorX="center"
          anchorY="middle"
        >
          GAME OVER!
        </Text>
      )}

      {victory && (
        <Text
          position={[0, 3, 0]}
          fontSize={0.8}
          color="#22c55e"
          anchorX="center"
          anchorY="middle"
        >
          VITÓRIA!
        </Text>
      )}

      {/* Controles de câmera */}
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.5}
      />
    </>
  )
}

export default function Home() {
  const [gameKey, setGameKey] = useState(0)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [gameStarted, setGameStarted] = useState(false)

  const startGame = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty)
    setGameStarted(true)
    setGameKey((prev) => prev + 1)
  }

  const resetGame = () => {
    setGameStarted(false)
    setGameKey((prev) => prev + 1)
  }

  if (!gameStarted) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto p-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">Campo Minado 3D</h1>
            <p className="text-slate-300 text-lg">Escolha a dificuldade para começar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((diff) => {
              const config = DIFFICULTIES[diff]
              return (
                <button
                  key={diff}
                  onClick={() => startGame(diff)}
                  className={`p-8 bg-gradient-to-br ${config.color} rounded-2xl hover:scale-105 transition-transform shadow-2xl`}
                >
                  <div className="text-white text-center">
                    <div className="text-3xl font-bold mb-3">{config.name}</div>
                    <div className="text-lg opacity-90">{config.mines} minas</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-12 bg-slate-800/60 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-bold text-xl mb-4 text-center">Como Jogar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
              <div>
                <div className="text-emerald-400 font-semibold mb-2">🎯 Objetivo</div>
                <div className="text-sm">Atravesse o campo do sul ao norte sem pisar em minas</div>
              </div>
              <div>
                <div className="text-blue-400 font-semibold mb-2">⌨️ Controles</div>
                <div className="text-sm">W/A/S/D para mover | Mouse para rotacionar câmera</div>
              </div>
              <div>
                <div className="text-yellow-400 font-semibold mb-2">🔍 Revelação</div>
                <div className="text-sm">O piso revela números mostrando minas próximas</div>
              </div>
              <div>
                <div className="text-red-400 font-semibold mb-2">⚠️ Cuidado</div>
                <div className="text-sm">Números maiores = mais minas ao redor!</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Campo Minado 3D</h1>
            <p className="text-slate-300">
              Dificuldade: <span className="font-bold text-white">{DIFFICULTIES[difficulty].name}</span> 
              {' '}({DIFFICULTIES[difficulty].mines} minas)
            </p>
          </div>
          <button
            onClick={resetGame}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-lg hover:scale-105 transition-transform shadow-lg"
          >
            Menu Principal
          </button>
        </div>
      </div>

      {/* Instruções */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-6">
        <div className="max-w-7xl mx-auto bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-yellow-400 font-bold mb-1">🎯 Objetivo</div>
              <div className="text-slate-300 text-sm">Chegue ao norte sem pisar em minas</div>
            </div>
            <div>
              <div className="text-emerald-400 font-bold mb-1">⌨️ Controles</div>
              <div className="text-slate-300 text-sm">W/A/S/D para mover | Mouse para rotacionar</div>
            </div>
            <div>
              <div className="text-blue-400 font-bold mb-1">🔍 Dica</div>
              <div className="text-slate-300 text-sm">Números indicam minas adjacentes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas 3D */}
      <Canvas
        key={gameKey}
        camera={{ position: [0, 8, 12], fov: 60 }}
        shadows
      >
        <Game3D difficulty={difficulty} onReset={resetGame} />
      </Canvas>
    </div>
  )
}
