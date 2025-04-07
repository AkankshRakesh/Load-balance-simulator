"use client"
import React, { useState, useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import {
  Chart as ChartJS,
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Chart } from "react-chartjs-2"
import * as THREE from "three"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Server, Activity, BarChart3, RefreshCw, Calculator, ArrowRight, ChevronRight } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Constants for the ACO algorithm
const PHEROMONE_DECAY = 0.8
const MAX_SERVERS = 10
const MIN_TASKS_PER_BATCH = 3
const MAX_TASKS_PER_BATCH = 5
const INITIAL_PHEROMONE = 1.0
const ALPHA = 1.0
const BETA = 2.0
const MIN_PHEROMONE = 0.1
const Q = 10

ChartJS.register(
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

const ACOVisualization = () => {
  const [servers, setServers] = useState(3)
  const [pheromones, setPheromones] = useState<number[]>(() => Array(3).fill(INITIAL_PHEROMONE))
  const [loads, setLoads] = useState<number[]>(() => Array(3).fill(0))
  const [isSimulating, setIsSimulating] = useState(false)
  const [taskAssignments, setTaskAssignments] = useState<{ server: number; task: number }[]>([])
  const [currentBatch, setCurrentBatch] = useState<number[]>([])
  const [calculationSteps, setCalculationSteps] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState(-1)
  const [autoPlay, setAutoPlay] = useState(false)
  const autoPlayRef = useRef(autoPlay)
  const [activeTaskIndex, setActiveTaskIndex] = useState(-1)
  

  // Update ref when autoPlay changes
  useEffect(() => {
    autoPlayRef.current = autoPlay
  }, [autoPlay])

  // Auto-play effect
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (autoPlay && currentStep < calculationSteps.length - 1) {
      timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
      }, 1500)
    } else if (currentStep >= calculationSteps.length - 1) {
      setAutoPlay(false)
    }
    return () => clearTimeout(timer)
  }, [autoPlay, currentStep, calculationSteps.length])

  const generateTaskBatch = () => {
    const batchSize = Math.floor(Math.random() * (MAX_TASKS_PER_BATCH - MIN_TASKS_PER_BATCH + 1)) + MIN_TASKS_PER_BATCH
    const newTasks = Array.from({ length: batchSize }, () => Math.floor(Math.random() * 20) + 5)
    setCurrentBatch(newTasks)
    setIsSimulating(false)
    setCalculationSteps([])
    setCurrentStep(-1)
    setActiveTaskIndex(-1)
  }

  const distributeCurrentBatch = () => {
    if (currentBatch.length === 0) return

    setIsSimulating(true)
    setCalculationSteps([])
    setCurrentStep(-1)
    setActiveTaskIndex(-1)

    const newLoads = [...loads]
    const newPheromones = pheromones.map((p) => Math.max(p * PHEROMONE_DECAY, MIN_PHEROMONE))
    const newAssignments: { server: number; task: number }[] = []
    const steps: {
      type: string;
      pheromones?: number[];
      loads?: number[];
      message?: string;
      task?: number;
      taskIndex?: number;
      loadFactors?: number[];
      pheromonePowers?: number[];
      rawProbabilities?: number[];
      probabilities?: number[];
      random?: number;
      cumulative?: number;
      selectedServer?: number;
      oldPheromone?: number;
      pheromoneContribution?: number;
      newPheromone?: number;
      assignments?: { server: number; task: number }[];
    }[] = []

    // Initial state step
    steps.push({
      type: "initial",
      pheromones: [...newPheromones],
      loads: [...newLoads],
      message: "Initial state with pheromone decay applied",
    })

    const sortedTasks = [...currentBatch].sort((a, b) => b - a)

    sortedTasks.forEach((task, taskIndex) => {
      // Calculate probabilities for each server
      const probabilities: number[] = []
      const rawProbabilities: number[] = []
      const loadFactors: number[] = []
      const pheromonePowers: number[] = []

      newPheromones.forEach((pheromone, i) => {
        const loadFactor = newLoads[i] > 0 ? newLoads[i] : 1
        loadFactors.push(loadFactor)

        const pheromonePower = Math.pow(pheromone, ALPHA)
        pheromonePowers.push(pheromonePower)

        const loadPower = Math.pow(1 / loadFactor, BETA)
        const rawProb = pheromonePower * loadPower
        rawProbabilities.push(rawProb)
      })

      const sumProbabilities = rawProbabilities.reduce((sum, p) => sum + p, 0)

      newPheromones.forEach((_, i) => {
        probabilities.push(rawProbabilities[i] / sumProbabilities)
      })

      // Add probability calculation step
      steps.push({
        type: "probability",
        task,
        taskIndex,
        pheromones: [...newPheromones],
        loads: [...newLoads],
        loadFactors: [...loadFactors],
        pheromonePowers: [...pheromonePowers],
        rawProbabilities: [...rawProbabilities],
        probabilities: [...probabilities],
        message: `Calculating probabilities for task ${task}`,
      })

      // Server selection step
      const random = Math.random()
      let cumulative = 0
      let selectedServer = 0

      for (let i = 0; i < probabilities.length; i++) {
        cumulative += probabilities[i]
        if (random <= cumulative) {
          selectedServer = i
          break
        }
      }

      steps.push({
        type: "selection",
        task,
        taskIndex,
        random,
        cumulative,
        selectedServer,
        probabilities: [...probabilities],
        message: `Selected server ${selectedServer + 1} for task ${task}`,
      })

      // Update loads
      newLoads[selectedServer] += task
      newAssignments.push({ server: selectedServer, task })

      // Pheromone update step
      const oldPheromone = newPheromones[selectedServer]
      const pheromoneContribution = Q / (newLoads[selectedServer] + 1)
      newPheromones[selectedServer] += pheromoneContribution

      steps.push({
        type: "update",
        task,
        taskIndex,
        selectedServer,
        oldPheromone,
        pheromoneContribution,
        newPheromone: newPheromones[selectedServer],
        loads: [...newLoads],
        pheromones: [...newPheromones],
        message: `Updated pheromone for server ${selectedServer + 1}`,
      })
    })

    // Final state step
    steps.push({
      type: "final",
      pheromones: [...newPheromones],
      loads: [...newLoads],
      assignments: [...newAssignments],
      message: "Final state after all tasks distributed",
    })

    setLoads(newLoads)
    setPheromones(newPheromones)
    setTaskAssignments(newAssignments)
    setCalculationSteps(steps)
    setCurrentStep(0)
    setIsSimulating(false)
  }

  const resetSimulation = React.useCallback(() => {
    setPheromones(Array(servers).fill(INITIAL_PHEROMONE))
    setLoads(Array(servers).fill(0))
    setTaskAssignments([])
    setCurrentBatch([])
    setIsSimulating(false)
    setCalculationSteps([])
    setCurrentStep(-1)
    setAutoPlay(false)
    setActiveTaskIndex(-1)
  }, [servers])

  useEffect(() => {
    resetSimulation()
  }, [servers, resetSimulation])

  const getColorForLoad = (load: number, maxLoad: number) => {
    const normalizedLoad = maxLoad > 0 ? load / maxLoad : 0
    const hue = 120 - normalizedLoad * 120
    return `hsl(${hue}, 100%, 50%)`
  }

  const maxLoad = Math.max(...loads, 1)

  // Get current state based on step
  const getCurrentState = React.useCallback(() => {
    if (currentStep === -1 || calculationSteps.length === 0) {
      return { pheromones, loads, activeServer: -1, activeTask: -1 };
    }

    const step = calculationSteps[currentStep];
    let activeServer = -1;
    let activeTask = -1;

    if (step.type === "selection" || step.type === "update") {
      activeServer = step.selectedServer ?? -1;
      activeTask = step.taskIndex ?? -1;
    } else if (step.type === "probability") {
      activeTask = step.taskIndex ?? -1;
    }

    return {
      pheromones: step.pheromones || pheromones,
      loads: step.loads || loads,
      activeServer,
      activeTask,
    };
  }, [currentStep, calculationSteps, pheromones, loads]);

  // Use a separate useEffect to set activeTaskIndex
  useEffect(() => {
    const currentState = getCurrentState(); // Call the function to get the current state
    setActiveTaskIndex(currentState.activeTask); // Set the active task index based on the current state
  }, [currentStep, calculationSteps, getCurrentState]);

  // Call getCurrentState to get the current state for rendering
  const currentState = getCurrentState();

  const FactorsPanel = () => {
    return (
      <Card className="border-none shadow-md bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">ACO Parameters</CardTitle>
          <CardDescription>Factors affecting task distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Pheromone Factors */}
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Pheromone
              </h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Initial:</span>
                  <span className="font-mono">{INITIAL_PHEROMONE.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Decay:</span>
                  <span className="font-mono">{PHEROMONE_DECAY.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Min:</span>
                  <span className="font-mono">{MIN_PHEROMONE.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit (Q):</span>
                  <span className="font-mono">{Q}</span>
                </div>
              </div>
            </div>

            {/* Load Factors */}
            <div className="space-y-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Load Balancing
              </h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Alpha (pheromone weight):</span>
                  <span className="font-mono">{ALPHA.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Beta (load weight):</span>
                  <span className="font-mono">{BETA.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current max load:</span>
                  <span className="font-mono">{Math.max(...currentState.loads, 0)}</span>
                </div>
              </div>
            </div>

            {/* Task Factors */}
            <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Task Batch
              </h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Batch size:</span>
                  <span className="font-mono">{currentBatch.length > 0 ? currentBatch.length : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Min tasks:</span>
                  <span className="font-mono">{MIN_TASKS_PER_BATCH}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max tasks:</span>
                  <span className="font-mono">{MAX_TASKS_PER_BATCH}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current tasks:</span>
                  <span className="font-mono">{currentBatch.join(", ") || "None"}</span>
                </div>
              </div>
            </div>

            {/* Probability Factors */}
            <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Current Probabilities
              </h4>
              <div className="text-xs space-y-1">
                {servers > 0 &&
                  currentState.pheromones.map((p: number, i: number) => {
                  const load: number = currentState.loads[i] || 1
                  const probability: number = Math.pow(p, ALPHA) * Math.pow(1 / load, BETA)
                  const total: number = currentState.pheromones.reduce((sum: number, p: number, j: number): number => {
                    const l: number = currentState.loads[j] || 1
                    return sum + Math.pow(p, ALPHA) * Math.pow(1 / l, BETA)
                  }, 0)
                  const normalized: number = (probability / total) * 100
                  return (
                    <div key={i} className="flex justify-between items-center">
                    <span>S{i + 1}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono w-10 text-right">{normalized.toFixed(1)}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${normalized}%` }}></div>
                      </div>
                    </div>
                    </div>
                  )
                  })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const ServerTower = ({
    position,
    load,
    maxLoad,
    index,
    isActive,
  }: {
    position: [number, number, number]
    load: number
    maxLoad: number
    index: number
    isActive: boolean
  }) => {
    const height = Math.max(0.1, (load / (maxLoad || 1)) * 3)
    const color = getColorForLoad(load, maxLoad)
    const assignedTasks = taskAssignments.filter((a) => a.server === index).length

    return (
      <group position={position}>
        {isActive && (
          <mesh position={[0, height + 0.5, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#ff5722" emissive="#ff5722" emissiveIntensity={0.5} />
          </mesh>
        )}

        <group position={[0, height + 1, 0]}>
          {[...Array(assignedTasks)].map((_, i) => (
            <mesh key={i} position={[0, i * 0.3, 0]}>
              <boxGeometry args={[0.3, 0.2, 0.3]} />
              <meshStandardMaterial color="#4CAF50" />
            </mesh>
          ))}
        </group>

        <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[1.5, 0.5, 1.5]} />
          <meshStandardMaterial color="#444" metalness={0.5} roughness={0.2} />
        </mesh>

        {/* Tower */}
        <mesh position={[0, height / 2 - 0.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[1, height, 1]} />
          <meshStandardMaterial color={new THREE.Color(color)} metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Top */}
        <mesh position={[0, height - 0.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color="#666" metalness={0.7} roughness={0.2} />
        </mesh>

        <Text position={[0, -1, 0]} fontSize={0.5} color="white" anchorX="center" anchorY="middle">
          {`Server ${index + 1}`}
        </Text>

        <Text position={[0, height + 0.3, 0]} fontSize={0.3} color="black" anchorX="center" anchorY="middle">
          {load.toFixed(0)}
        </Text>

        <Text position={[0, -1.5, 0]} fontSize={0.3} color="white" anchorX="center" anchorY="middle">
          {`P: ${currentState.pheromones[index].toFixed(2)}`}
        </Text>
      </group>
    )
  }

  const StepDetails = () => {
    if (currentStep === -1 || calculationSteps.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No calculation steps available. Generate and distribute tasks to see the detailed process.
        </div>
      )
    }

    const step = calculationSteps[currentStep]
    
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Badge
            variant={
              step.type === "initial"
                ? "outline"
                : step.type === "probability"
                  ? "secondary"
                  : step.type === "selection"
                    ? "default"
                    : step.type === "update"
                      ? "destructive"
                      : "outline"
            }
          >
            {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
          </Badge>
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {calculationSteps.length}
          </div>
        </div>

        <div className="text-sm">{step.message}</div>

        {step.type === "probability" && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
            <div className="text-sm font-medium">Calculating probabilities for task value: {step.task}</div>

            <div className="space-y-2">
              {step.pheromones.map((pheromone: number, i: number) => {
                const loadFactor = step.loadFactors[i]
                const pheromonePower = step.pheromonePowers[i]
                const rawProb = step.rawProbabilities[i]
                const normalizedProb = step.probabilities[i] * 100

                return (
                  <div key={i} className="text-xs space-y-1 border-b pb-2">
                    <div className="font-medium">Server {i + 1}</div>
                    <div className="grid grid-cols-2 gap-x-4">
                      <div>Pheromone (P): {pheromone.toFixed(2)}</div>
                      <div>Load (L): {step.loads[i]}</div>
                      <div>
                        P<sup>{ALPHA}</sup>: {pheromonePower.toFixed(4)}
                      </div>
                      <div>
                        1/L<sup>{BETA}</sup>: {Math.pow(1 / loadFactor, BETA).toFixed(4)}
                      </div>
                      <div>Raw probability: {rawProb.toFixed(4)}</div>
                      <div>Normalized: {normalizedProb.toFixed(2)}%</div>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${normalizedProb}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="text-xs">
              <div className="font-medium">Formula:</div>
              <div className="font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1">
                P(Server) = (Pheromone<sup>{ALPHA}</sup> × (1/Load)<sup>{BETA}</sup>) ÷ Σ(All server probabilities)
              </div>
            </div>
          </div>
        )}

        {step.type === "selection" && (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Random value:</span> {step.random.toFixed(4)}
            </div>

            <div className="space-y-2">
              {step.probabilities.map((prob: number, i: number) => {
                const cumulative = step.probabilities.slice(0, i + 1).reduce((sum: number, p: number) => sum + p, 0)
                const isSelected = i === step.selectedServer

                return (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded ${isSelected ? "bg-green-100 dark:bg-green-900/30" : ""}`}
                  >
                    <div className="flex justify-between">
                      <span>Server {i + 1}</span>
                      <span>Probability: {(prob * 100).toFixed(2)}%</span>
                      <span>Cumulative: {(cumulative * 100).toFixed(2)}%</span>
                    </div>
                    {isSelected && (
                      <div className="mt-1 text-green-700 dark:text-green-400 font-medium flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        Selected because {step.random.toFixed(4)} ≤ {cumulative.toFixed(4)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-xs">
              <div className="font-medium">Selection Process:</div>
              <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1">
                1. Generate random number: {step.random.toFixed(4)}
                <br />
                2. Find first server where cumulative probability ≥ random number
                <br />
                3. Selected Server {step.selectedServer + 1} for task {step.task}
              </div>
            </div>
          </div>
        )}

        {step.type === "update" && (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Updating pheromone for Server {step.selectedServer + 1}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>Previous pheromone:</div>
                <div className="font-mono">{step.oldPheromone.toFixed(4)}</div>

                <div>Task value:</div>
                <div className="font-mono">{step.task}</div>

                <div>New server load:</div>
                <div className="font-mono">{step.loads[step.selectedServer]}</div>

                <div>Pheromone contribution:</div>
                <div className="font-mono">{step.pheromoneContribution.toFixed(4)}</div>

                <div>New pheromone value:</div>
                <div className="font-mono font-bold">{step.newPheromone.toFixed(4)}</div>
              </div>
            </div>

            <div className="text-xs">
              <div className="font-medium">Pheromone Update Formula:</div>
              <div className="font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1">
                Pheromone += Q / (Load + 1)
                <br />
                {step.oldPheromone.toFixed(4)} += {Q} / ({step.loads[step.selectedServer]} + 1)
                <br />
                {step.oldPheromone.toFixed(4)} += {step.pheromoneContribution.toFixed(4)}
                <br />= {step.newPheromone.toFixed(4)}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const TaskList = () => {
    if (currentBatch.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">No tasks available. Generate tasks to see the list.</div>
      )
    }

    return (
      <div className="p-4">
        <div className="text-sm font-medium mb-2">Current Task Batch</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {currentBatch.map((task, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg border ${index === activeTaskIndex ? "bg-primary/10 border-primary" : "bg-slate-50 dark:bg-slate-900"}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Task {index + 1}</span>
                <Badge variant="outline">{task}</Badge>
              </div>
              {taskAssignments.find((a) => a.task === task) && (
                <div className="text-xs mt-1 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Server {taskAssignments.find((a) => a.task === task)?.server !== undefined ? taskAssignments.find((a) => a.task === task)!.server + 1 : "N/A"}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
  // interface ChartOptions {
  //   responsive: boolean;
  //   maintainAspectRatio: boolean;
  //   scales: {
  //     y: {
  //       beginAtZero: boolean;
  //       title: { display: boolean; text: string; font: { weight: string } };
  //       grid: { color: string };
  //     };
  //     y1: {
  //       position: "right";
  //       beginAtZero: boolean;
  //       title: { display: boolean; text: string; font: { weight: string } };
  //       grid: { drawOnChartArea: boolean };
  //     };
  //     x: {
  //       title: { display: boolean; text: string; font: { weight: string } };
  //       grid: { color: string };
  //     };
  //   };
  //   plugins: {
  //     legend: {
  //       position: "top";
  //       labels: { font: { size: number } };
  //     };
  //     tooltip: {
  //       backgroundColor: string;
  //       titleFont: { size: number };
  //       bodyFont: { size: number };
  //       padding: number;
  //       cornerRadius: number;
  //       callbacks: {
  //         label: (tooltipItem: { datasetIndex: number; parsed: { y: number } }) => string;
  //       };
  //     };
  //   };
  //   animation: {
  //     duration: number;
  //     easing: "easeInOutQuad";
  //   };
  // }

  // const chartOptions: ChartOptions = {
  //   responsive: true,
  //   maintainAspectRatio: false,
  //   scales: {
  //     y: {
  //       beginAtZero: true,
  //       title: { display: true, text: "Load", font: { weight: "bold" } },
  //       grid: { color: "rgba(0,0,0,0.05)" },
  //     },
  //     y1: {
  //       position: "right",
  //       beginAtZero: true,
  //       title: { display: true, text: "Pheromone Strength", font: { weight: "bold" } },
  //       grid: { drawOnChartArea: false },
  //     },
  //     x: {
  //       title: { display: true, text: "Servers", font: { weight: "bold" } },
  //       grid: { color: "rgba(0,0,0,0.05)" },
  //     },
  //   },
  //   plugins: {
  //     legend: {
  //       position: "top",
  //       labels: { font: { size: 12 } },
  //     },
  //     tooltip: {
  //       backgroundColor: "rgba(0,0,0,0.8)",
  //       titleFont: { size: 14 },
  //       bodyFont: { size: 13 },
  //       padding: 10,
  //       cornerRadius: 6,
  //       callbacks: {
  //         label: (tooltipItem) => {
  //           const datasetIndex = tooltipItem.datasetIndex;
  //           const value = tooltipItem.parsed.y;
  //           if (datasetIndex === 0) {
  //             return `Load: ${value}`;
  //           } else {
  //             return `Pheromone: ${value.toFixed(2)}`;
  //           }
  //         },
  //       },
  //     },
  //   },
  //   animation: {
  //     duration: 1000,
  //     easing: "easeInOutQuad",
  //   },
  // };
  return (
    <div className="p-4 space-y-6">
      <Card className="border-none shadow-md bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="h-6 w-6 text-primary" />
            ACO Load Balancer Simulator
          </CardTitle>
          <CardDescription>Ant Colony Optimization algorithm for distributing tasks across servers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-medium text-sm">Servers: {servers}</label>
                <Server className="h-4 w-4 text-muted-foreground" />
              </div>
              <Slider
                min={1}
                max={MAX_SERVERS}
                step={1}
                value={[servers]}
                onValueChange={(value) => {
                  const newServers = value[0]
                  setServers(newServers)
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={generateTaskBatch} disabled={isSimulating} className="gap-2" variant="outline">
                <Activity className="h-4 w-4" />
                Generate Tasks
              </Button>

              <Button
                onClick={distributeCurrentBatch}
                disabled={isSimulating || currentBatch.length === 0}
                className="gap-2"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    Distribute Tasks
                  </>
                )}
              </Button>

              <Button variant="destructive" onClick={resetSimulation} size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <FactorsPanel />

      

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-md overflow-hidden bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="h-[350px]">
            <Canvas camera={{ position: [0, 5, servers * 1.5], fov: 50 }} shadows>
              <color attach="background" args={["#f8fafc"]} />
              <fog attach="fog" args={["#f8fafc", 10, 30]} />

              <ambientLight intensity={0.5} />
              <directionalLight
                position={[10, 10, 5]}
                intensity={1}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
              />
              <spotLight position={[-10, 10, -5]} intensity={0.5} angle={0.3} penumbra={0.5} castShadow />

              <OrbitControls enableZoom={true} enablePan={true} minDistance={5} maxDistance={20} />

              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial color="#f0f0f0" />
              </mesh>

              <gridHelper args={[50, 50, "#ccc", "#ddd"]} position={[0, -0.9, 0]} />

                {currentState.loads.map((load: number, i: number) => {
                const isActive: boolean = currentState.activeServer === i
                return (
                  <ServerTower
                  key={i}
                  position={[i * 3 - (servers - 1) * 1.5, 0, 0] as [number, number, number]}
                  load={load}
                  maxLoad={maxLoad}
                  index={i}
                  isActive={isActive}
                  />
                )
                })}
            </Canvas>
          </div>
        </Card>

        <Card className="border-none shadow-md bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
            <div className="p-4 h-[350px]">
            <Chart
              type="bar"
              data={{
              labels: currentState.loads.map((_: number, i: number) => `Server ${i + 1}`),
              datasets: [
                {
                label: "Current Load",
                data: currentState.loads,
                backgroundColor: currentState.loads.map(
                  (load: number) => `hsla(${120 - (load / (maxLoad || 1)) * 120}, 100%, 50%, 0.7)`,
                ),
                borderColor: currentState.loads.map(
                  (load: number) => `hsla(${120 - (load / (maxLoad || 1)) * 120}, 100%, 30%, 1)`,
                ),
                borderWidth: 1,
                borderRadius: 6,
                },
                {
                label: "Pheromone Trail",
                data: currentState.pheromones,
                backgroundColor: "rgba(100, 149, 237, 0.2)",
                borderColor: "rgba(70, 130, 180, 1)",
                borderWidth: 2,
                type: "line",
                yAxisID: "y1",
                pointRadius: 6,
                pointBackgroundColor: "rgba(70, 130, 180, 0.8)",
                tension: 0.3,
                },
              ],
              } as {
              labels: string[];
              datasets: Array<{
                label: string;
                data: number[];
                backgroundColor: string | string[];
                borderColor: string | string[];
                borderWidth: number;
                borderRadius?: number;
                type?: "line" | "bar";
                yAxisID?: string;
                pointRadius?: number;
                pointBackgroundColor?: string;
                tension?: number;
              }>;
              }}
              // options={chartOptions}
            />
            </div>
        </Card>
      </div>
      {calculationSteps.length > 0 && (
        <Card className="border-none shadow-md bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Step-by-Step Calculation
            </CardTitle>
            <CardDescription>Watch how the ACO algorithm makes decisions for each task</CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)} disabled={currentStep <= 0} className="cursor-pointer">
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                  disabled={currentStep <= 0}
                  className="cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => Math.min(calculationSteps.length - 1, prev + 1))}
                  disabled={currentStep >= calculationSteps.length - 1}
                  className="cursor-pointer"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(calculationSteps.length - 1)}
                  disabled={currentStep >= calculationSteps.length - 1}
                  className="cursor-pointer"
                >
                  Last
                </Button>
              </div>
              <Button
                variant={autoPlay ? "secondary" : "outline"}
                size="sm"
                onClick={() => setAutoPlay(!autoPlay)}
                disabled={currentStep >= calculationSteps.length - 1}
              >
                {autoPlay ? "Pause" : "Auto Play"}
              </Button>
            </div>
          </CardContent>

          <Tabs defaultValue="details">
            <div className="px-6">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">
                  Calculation Details
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1">
                  Task List
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="details">
              <StepDetails />
            </TabsContent>
            <TabsContent value="tasks">
              <TaskList />
            </TabsContent>
          </Tabs>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Task Assignment Overview</CardTitle>
          <CardDescription>See which server handled which tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr>
                  <th className="border px-4 py-2 text-left">Server</th>
                  <th className="border px-4 py-2 text-left">Tasks Assigned</th>
                  <th className="border px-4 py-2 text-left">Total Load</th>
                  <th className="border px-4 py-2 text-left">Current Pheromone</th>
                </tr>
              </thead>
              <tbody>
                {currentState.loads.map((load: number, serverIndex: number) => {
                  const serverTasks: number[] = taskAssignments
                  .filter((assignment: { server: number; task: number }) => assignment.server === serverIndex)
                  .map((assignment: { server: number; task: number }) => assignment.task)

                  return (
                  <tr key={serverIndex} className={currentState.activeServer === serverIndex ? "bg-primary/10" : ""}>
                    <td className="border px-4 py-2">Server {serverIndex + 1}</td>
                    <td className="border px-4 py-2">{serverTasks.length > 0 ? serverTasks.join(", ") : "None"}</td>
                    <td className="border px-4 py-2">{load}</td>
                    <td className="border px-4 py-2">{currentState.pheromones[serverIndex].toFixed(2)}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="formulas">
          <AccordionTrigger className="text-lg font-medium cursor-pointer">ACO Formulas Explained</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <h4 className="font-medium">Probability Formula</h4>
                <div className="text-sm">
                  <p className="mb-2">The probability of selecting server i is calculated as:</p>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded font-mono text-sm">
                    P(S<sub>i</sub>) =
                    <span>
                      {" "}
                      (P<sub>i</sub>
                      <sup>&alpha;</sup>/ L<sub>i</sub>
                      <sup>β</sup>) / Σ(P<sub>tot</sub>
                      <sup>&alpha;</sup>/ L<sub>tot</sub>
                      <sup>β</sup>){" "}
                    </span>
                  </div>
                  <p className="mt-3">Where:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>
                      P<sub>i</sub>: Pheromone level of server i
                    </li>
                    <li>
                      L<sub>i</sub>: Load of server i
                    </li>
                    <li>&alpha;: Pheromone weight ({ALPHA})</li>
                    <li>β: Load weight ({BETA})</li>
                  </ul>
                </div>
                <div className="text-sm mt-2">
                  <p className="font-medium">In plain English:</p>
                  <p>
                    Servers with higher pheromone levels and lower loads are more likely to be selected. The α and β
                    parameters control the relative importance of pheromones versus load balancing.
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <h4 className="font-medium">Pheromone Update Formula</h4>
                <div className="text-sm">
                  <p className="mb-2">After each task assignment, pheromones are updated:</p>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded font-mono text-sm">
                    <p>
                      P(S<sub>i</sub>) = (1 - ρ) * P(S<sub>i</sub>) + ΔP(S<sub>i</sub>)
                    </p>
                    <p className="mt-2">
                      Where ΔP(S<sub>i</sub>) = Q / (L(S<sub>i</sub>) + 1)
                    </p>
                  </div>
                  <p className="mt-3">Where:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>ρ: Pheromone decay rate ({1 - PHEROMONE_DECAY})</li>
                    <li>Q: Pheromone deposit constant ({Q})</li>
                    <li>
                      L(S<sub>i</sub>): Load of server i
                    </li>
                  </ul>
                </div>
                <div className="text-sm mt-2">
                  <p className="font-medium">In plain English:</p>
                  <p>
                    Pheromones evaporate over time (decay), and new pheromones are deposited inversely proportional to
                    the server&apos;s load. This creates a feedback loop where less loaded servers become more attractive for
                    future tasks.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="algorithm">
          <AccordionTrigger className="text-lg font-medium cursor-pointer">How ACO Load Balancing Works</AccordionTrigger>
          <AccordionContent>
            <div className="p-4 space-y-4">
              <p className="text-sm">
                Ant Colony Optimization (ACO) is a nature-inspired algorithm that mimics how ants find optimal paths
                using pheromone trails. In load balancing, we use this concept to distribute tasks efficiently across
                servers.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">1. Initialization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">
                      Each server starts with an equal amount of pheromone ({INITIAL_PHEROMONE}). This gives all servers
                      an equal chance of being selected initially.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">2. Task Assignment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">
                      For each task, we calculate the probability of assigning it to each server based on pheromone
                      levels and current loads. Servers with higher pheromones and lower loads are more likely to be
                      chosen.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">3. Pheromone Update</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">
                      After assigning a task, we update the pheromone level of the selected server. Pheromones decay
                      over time, and new pheromones are added based on how well the server is performing.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Benefits of ACO Load Balancing:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Adaptive: Automatically adjusts to changing server conditions</li>
                  <li>Decentralized: No need for a central controller</li>
                  <li>Fault-tolerant: Can handle server failures gracefully</li>
                  <li>Scalable: Works well with increasing numbers of servers</li>
                  <li>Self-organizing: Finds near-optimal solutions without explicit programming</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export default ACOVisualization

