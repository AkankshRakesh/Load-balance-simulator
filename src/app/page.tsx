"use client";
import React, { useState,  useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Chart as ChartJS, BarController, LineController, CategoryScale, LinearScale, PointElement, BarElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import { Chart } from "react-chartjs-2";
import * as THREE from "three";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, Activity, BarChart3, RefreshCw } from "lucide-react"
import { Slider } from "@/components/ui/slider";

const PHEROMONE_DECAY = 0.8;
const MAX_SERVERS = 10;
const MIN_TASKS_PER_BATCH = 3;
const MAX_TASKS_PER_BATCH = 5;
const INITIAL_PHEROMONE = 1.0;
const ALPHA = 1.0;  
const BETA = 2.0;   
const MIN_PHEROMONE = 0.1;
const Q = 10;    

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
  Legend
);

const ACOVisualization = () => {
  const [servers, setServers] = useState(3);
  const [pheromones, setPheromones] = useState<number[]>(() => Array(3).fill(INITIAL_PHEROMONE));
  const [loads, setLoads] = useState<number[]>(() => Array(3).fill(0));
  const [isSimulating, setIsSimulating] = useState(false);
  const [taskAssignments, setTaskAssignments] = useState<{server: number, task: number}[]>([]);
  const [currentBatch, setCurrentBatch] = useState<number[]>([]);

  const generateTaskBatch = () => {
    const batchSize = Math.floor(Math.random() * (MAX_TASKS_PER_BATCH - MIN_TASKS_PER_BATCH + 1)) + MIN_TASKS_PER_BATCH;
    const newTasks = Array.from({ length: batchSize }, () => 
      Math.floor(Math.random() * 20) + 5 
    );
    setCurrentBatch(newTasks);
    setIsSimulating(false);
  };
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
                  <span className="font-mono">{Math.max(...loads, 0)}</span>
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
                  <span className="font-mono">{currentBatch.length > 0 ? currentBatch.length : '0'}</span>
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
                  <span className="font-mono">{currentBatch.join(', ') || 'None'}</span>
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
                {servers > 0 && pheromones.map((p, i) => {
                  const load = loads[i] || 1;
                  const probability = Math.pow(p, ALPHA) * Math.pow(1/load, BETA);
                  const total = pheromones.reduce((sum, p, j) => {
                    const l = loads[j] || 1;
                    return sum + Math.pow(p, ALPHA) * Math.pow(1/l, BETA);
                  }, 0);
                  const normalized = (probability / total) * 100;
                  return (
                    <div key={i} className="flex justify-between items-center">
                      <span>S{i+1}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono w-10 text-right">{normalized.toFixed(1)}%</span>
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500" 
                            style={{ width: `${normalized}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const distributeCurrentBatch = () => {
    if (currentBatch.length === 0) return;

    setIsSimulating(true);

    const newLoads = [...loads];
    const newPheromones = pheromones.map(p => Math.max(p * PHEROMONE_DECAY, MIN_PHEROMONE));
    const newAssignments: { server: number; task: number }[] = [];

    const sortedTasks = [...currentBatch].sort((a, b) => b - a);
    console.log(sortedTasks);
    sortedTasks.forEach((task) => {
        const probabilities = newPheromones.map((pheromone, i) => {
            const loadFactor = newLoads[i] > 0 ? newLoads[i] : 1; 
            return Math.pow(pheromone, ALPHA) * Math.pow(1 / loadFactor, BETA);
        });

        const sumProbabilities = probabilities.reduce((sum, p) => sum + p, 0);
        const normalizedProbabilities = probabilities.map(p => p / sumProbabilities);

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

        newLoads[selectedServer] += task;
        newAssignments.push({ server: selectedServer, task });
        newAssignments.sort((a, b) => b.server - a.server);
        
        const pheromoneContribution = Q / (newLoads[selectedServer] + 1); 
        newPheromones[selectedServer] += pheromoneContribution;
    });

    setLoads(newLoads);
    setPheromones(newPheromones);
    setTaskAssignments(newAssignments);
  };

  const resetSimulation = React.useCallback(() => {
    setPheromones(Array(servers).fill(INITIAL_PHEROMONE));
    setLoads(Array(servers).fill(0));
    setTaskAssignments([]);
    setCurrentBatch([]);
    setIsSimulating(false);
  }, [servers]);

  useEffect(() => {
    resetSimulation();
  }, [servers, resetSimulation]);

  useEffect(() => {
    if (taskAssignments.length > 0) {
      setIsSimulating(false);
    }
  }, [taskAssignments]);

  const getColorForLoad = (load: number, maxLoad: number) => {
    const normalizedLoad = maxLoad > 0 ? load / maxLoad : 0;
    const hue = 120 - normalizedLoad * 120;
    return `hsl(${hue}, 100%, 50%)`;
  };

  const maxLoad = Math.max(...loads, 1);
  
  
  
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
                  const newServers = value[0];
                  setServers(newServers);
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
              <Chart type="bar"
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
                    easing: "easeInOutQuart",
                  },
                }}
              />
            </div>
          </Card>
          
      </div>
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
          </tr>
        </thead>
        <tbody>
      {taskAssignments.slice(-5).reverse().map((assignment, i) => (
            <tr key={i}>
              <td className="border px-4 py-2">Server {assignment.server + 1}</td>
              <td className="border px-4 py-2">{assignment.task}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>
<div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <h4 className="font-medium text-sm">Probability Formula</h4>
          <p className="text-xs">
            P(S<sub>i</sub>) = 
            <span className="font-mono"> (P<sub>i</sub><sup>&alpha;</sup>/ L<sub>i</sub><sup>β</sup>) / Σ(P<sub>tot</sub><sup>&alpha;</sup>/ L<sub>tot</sub><sup>β</sup>) </span>
          </p>
          <p className="text-xs">
            Where:
          </p>
          <ul className="text-xs list-disc list-inside">
            <li>P<sub>i</sub>: Pheromone level of server i</li>
            <li>L<sub>i</sub>: Load of server i</li>
            <li>&alpha;: Pheromone weight</li>
            <li>β: Load weight</li>
          </ul>
        </div>
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <h4 className="font-medium text-sm">Pheromone Update Formula</h4>
          <p className="text-xs">
            P(S<sub>i</sub>) = (1 - ρ) * P(S<sub>i</sub>) + ΔP(S<sub>i</sub>)
          </p>
          <p className="text-xs">
            Where ΔP(S<sub>i</sub>) = Q / (L(S<sub>i</sub>) + 1)
          </p>
          <p className="text-xs">
            Where:
          </p>
          <ul className="text-xs list-disc list-inside">
            <li>ρ: Pheromone decay rate</li>
            <li>Q: Pheromone deposit constant</li>
            <li>L(S<sub>i</sub>): Load of server i</li>
          </ul>
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