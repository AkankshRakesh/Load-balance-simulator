"use client";
import React, { useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import * as THREE from "three";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Server, Activity, BarChart3, RefreshCw } from "lucide-react"
import { Slider } from "@/components/ui/slider";

// Constants for easier tuning
const PHEROMONE_DECAY = 0.8;
const PHEROMONE_WEIGHT = 0.2;
const MAX_SERVERS = 10;
const MIN_TASKS_PER_BATCH = 3;
const MAX_TASKS_PER_BATCH = 5;
const INITIAL_PHEROMONE = 1.0;
const ALPHA = 1.0;  // Influence of pheromone
const BETA = 2.0;   // Influence of task size
const MIN_PHEROMONE = 0.1;
const Q = 10;    

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

const ACOVisualization = () => {
  const [servers, setServers] = useState(3);
  const [pheromones, setPheromones] = useState<number[]>(() => Array(3).fill(INITIAL_PHEROMONE));
  const [loads, setLoads] = useState<number[]>(() => Array(3).fill(0));
  const [isSimulating, setIsSimulating] = useState(false);
  const [taskAssignments, setTaskAssignments] = useState<{server: number, task: number}[]>([]);
  const [currentBatch, setCurrentBatch] = useState<number[]>([]);
  
  // Generate a small batch of tasks (3-5)
  const generateTaskBatch = () => {
    const batchSize = Math.floor(Math.random() * (MAX_TASKS_PER_BATCH - MIN_TASKS_PER_BATCH + 1)) + MIN_TASKS_PER_BATCH;
    const newTasks = Array.from({ length: batchSize }, () => 
      Math.floor(Math.random() * 20) + 5 // Tasks between 5-25
    );
    setCurrentBatch(newTasks);
    setIsSimulating(false); // Reset simulation state
  };

  // Distribute current batch of tasks
  const distributeCurrentBatch = () => {
    if (currentBatch.length === 0) return;
  
    setIsSimulating(true);
  
    const newLoads = [...loads];
    const newPheromones = pheromones.map(p => Math.max(p * PHEROMONE_DECAY, MIN_PHEROMONE));
    const newAssignments: { server: number; task: number }[] = [];
  
    const sortedTasks = [...currentBatch].sort((a, b) => b - a);
  
    sortedTasks.forEach((task) => {
      // Compute probabilities for each server using ACO formula
      const probabilities = newPheromones.map((pheromone, i) => {
        return Math.pow(pheromone, ALPHA) * Math.pow(1 / (newLoads[i] + 1), BETA);
      });
  
      const sumProbabilities = probabilities.reduce((sum, p) => sum + p, 0);
      const normalizedProbabilities = probabilities.map(p => p / sumProbabilities);
  
      // Select server probabilistically
      const random = Math.random();
      let cumulative = 0;
      let selectedServer = 0;
  
      for (let i = 0; i < normalizedProbabilities.length; i++) {
        cumulative += normalizedProbabilities[i];
        if (random <= cumulative) {
          selectedServer = i;
          break;
        }
      }
  
      // Assign task
      newLoads[selectedServer] += task;
      newAssignments.push({ server: selectedServer, task });
  
      // **Pheromone Update Rule**
      newPheromones[selectedServer] += (Q / task);
    });
  
    setLoads(newLoads);
    setPheromones(newPheromones);
    setTaskAssignments(newAssignments);
  };
  
  
  // Ensure UI updates after assignment
  useEffect(() => {
    if (taskAssignments.length > 0) {
      setIsSimulating(false);
    }
  }, [taskAssignments]);
  

  const resetSimulation = () => {
    setPheromones(Array(servers).fill(INITIAL_PHEROMONE));
    setLoads(Array(servers).fill(0));
    setTaskAssignments([]);
    setCurrentBatch([]);
    setIsSimulating(false);
  };

  // Calculate colors based on load distribution
  const getColorForLoad = (load: number, maxLoad: number) => {
    const normalizedLoad = maxLoad > 0 ? load / maxLoad : 0;
    const hue = 120 - normalizedLoad * 120;
    return `hsl(${hue}, 100%, 50%)`;
  };

  const maxLoad = Math.max(...loads, 1);
  const calculateLoadEfficiency = () => {
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize efficiency to a percentage (100 = perfect balance, 0 = worst case)
    const maxPossibleStdDev = avgLoad; // Approximation for normalization
    const efficiency = 100 * (1 - stdDev / (maxPossibleStdDev || 1));
    
    return Math.max(0, parseFloat(efficiency.toFixed(2))); // Ensuring non-negative values
  };
  
  const efficiency = useMemo(() => calculateLoadEfficiency(), [loads]);
  
  
  // Server Tower Component
  const ServerTower = ({ position, load, maxLoad, index, isActive }: {
    position: [number, number, number];
    load: number;
    maxLoad: number;
    index: number;
    isActive: boolean;
  }) => {
    const height = Math.max(0.1, load / (maxLoad || 1) * 3);
    const color = getColorForLoad(load, maxLoad);
    const assignedTasks = taskAssignments.filter(a => a.server === index).length;

    return (
      <group position={position}>
        {isActive && (
          <mesh position={[0, height + 0.5, 0]}>
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
        
        <Text
          position={[0, -1, 0]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {`Server ${index + 1}`}
        </Text>
        
        <Text
          position={[0, height + 0.3, 0]}
          fontSize={0.3}
          color="black"
          anchorX="center"
          anchorY="middle"
        >
          {load.toFixed(0)}
        </Text>
      </group>
    );
  };

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
                  resetSimulation()
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
      
      <AnimatePresence>
      {currentBatch.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-gray-50 rounded-lg"
        >
          <h3 className="font-medium mb-2">Current Batch: {currentBatch.join(', ')}</h3>
          <div className="flex flex-wrap gap-2">
            {taskAssignments.slice(-5).reverse().map((assignment, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-3 py-1 rounded-full text-sm ${
                  assignment.server % 3 === 0 ? 'bg-blue-100 text-blue-800' :
                  assignment.server % 3 === 1 ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}
              >
                {assignment.task} → S{assignment.server + 1}
              </motion.div>
            ))}
            <h3 className="font-medium">Total Efficiency: {efficiency}%</h3>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

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

                {loads.map((load, i) => {
                  const isActive = taskAssignments.some(
                    (a) => a.server === i && taskAssignments.indexOf(a) >= taskAssignments.length - currentBatch.length,
                  )
                  return (
                    <ServerTower
                      key={i}
                      position={[i * 3 - (servers - 1) * 1.5, 0, 0]}
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
              <Bar
                data={{
                  labels: loads.map((_, i) => `Server ${i + 1}`),
                  datasets: [
                    {
                      label: "Current Load",
                      data: loads,
                      backgroundColor: loads.map(
                        (load) => `hsla(${120 - (load / (maxLoad || 1)) * 120}, 100%, 50%, 0.7)`,
                      ),
                      borderColor: loads.map((load) => `hsla(${120 - (load / (maxLoad || 1)) * 120}, 100%, 30%, 1)`),
                      borderWidth: 1,
                      borderRadius: 6,
                    },
                    {
                      label: "Pheromone Trail",
                      data: pheromones,
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
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: "Load", font: { weight: "bold" } },
                      grid: { color: "rgba(0,0,0,0.05)" },
                    },
                    y1: {
                      position: "right",
                      beginAtZero: true,
                      title: { display: true, text: "Pheromone Strength", font: { weight: "bold" } },
                      grid: { drawOnChartArea: false },
                    },
                    x: {
                      title: { display: true, text: "Servers", font: { weight: "bold" } },
                      grid: { color: "rgba(0,0,0,0.05)" },
                    },
                  },
                  plugins: {
                    legend: {
                      position: "top",
                      labels: { font: { size: 12 } },
                    },
                    tooltip: {
                      backgroundColor: "rgba(0,0,0,0.8)",
                      titleFont: { size: 14 },
                      bodyFont: { size: 13 },
                      padding: 10,
                      cornerRadius: 6,
                      callbacks: {
                        label: (ctx) => {
                          if (ctx.datasetIndex === 0) {
                            return `Load: ${ctx.raw}`
                          } else {
                            return `Pheromone: ${(ctx.raw as number)?.toFixed(2)}`
                          }
                        },
                      },
                    },
                  },
                  animation: {
                    duration: 1000,
                    easing: "easeOutQuart",
                  },
                }}
              />
            </div>
          </Card>
          
      </div>
      <Card className="border-none shadow-md bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This simulator demonstrates Ant Colony Optimization (ACO) for load balancing. Tasks are assigned to servers
            based on pheromone levels and current server loads. Servers with higher pheromone levels and lower loads are
            more likely to be chosen. After each assignment, pheromone levels are updated to reflect the quality of the
            solution.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ACOVisualization;