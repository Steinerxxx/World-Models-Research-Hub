import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '@/config';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp } from "lucide-react";
import { SUBJECT_TAGS, ARCHITECTURE_TAGS } from '@/constants/tags';

interface Paper {
  id: number;
  title: string;
  authors: string[];
  publication_date: string;
  tags?: string[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "Reinforcement Learning": "Algorithms that learn optimal actions through trial and error interactions.",
  "Computer Vision": "Methods for acquiring, processing, and understanding digital images and videos.",
  "Natural Language Processing": "Interactions between computers and human language, including generation and understanding.",
  "Robotics": "Design and operation of robots, often involving perception, control, and planning.",
  "Generative Models": "Models capable of generating new data instances similar to training data (e.g., GANs, Diffusion).",
  "Representation Learning": "Learning representations of data that make it easier to extract useful information.",
  "Planning": "Algorithms for determining a sequence of actions to achieve a goal.",
  "Control": "Managing the behavior of dynamical systems.",
  "RNN": "Recurrent Neural Networks, specialized for processing sequential data.",
  "Transformer": "Attention-based architecture that has revolutionized NLP and other fields.",
  "Diffusion Model": "Generative models that learn to reverse a gradual noising process.",
  "Diffusion Models": "Generative models that learn to reverse a gradual noising process.",
  "State Space Models": "Efficient sequence models like Mamba that scale linearly with sequence length.",
  "Sim-to-Real": "Techniques for transferring models or policies trained in simulation to physical robots.",
  "Contrastive Learning": "Learning representations by contrasting positive and negative pairs.",
  "Graph Neural Networks": "Neural networks designed to operate on graph-structured data."
};

export default function Trends() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/papers?t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.json();
      })
      .then(data => {
        setPapers(data);
        setLoading(false);
      })
      .catch(async (err) => {
        console.warn('Backend fetch failed, switching to Mock Data:', err);
        const { MOCK_PAPERS } = await import('@/data/mockData');
        setPapers(MOCK_PAPERS);
        setUsingMockData(true);
        setError(null);
        setLoading(false);
      });
  }, []);

  const monthlyData = useMemo(() => {
    const counts: Record<string, number> = {};
    papers.forEach(paper => {
      const date = new Date(paper.publication_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [papers]);

  const tagData = useMemo(() => {
    const counts: Record<string, number> = {};
    papers.forEach(paper => {
      paper.tags?.forEach(tag => {
        // Filter out "World Models" and "Model-Based RL" as requested
        if (tag === 'World Models' || tag === 'Model-Based RL') return;
        
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .filter(([name, value]) => {
        const lowerName = name.toLowerCase();
        const isEmerging = !SUBJECT_TAGS.map(s => s.toLowerCase()).includes(lowerName) && 
                          !ARCHITECTURE_TAGS.map(a => a.toLowerCase()).includes(lowerName);
        // Only show emerging tags if they have 5 or more papers
        if (isEmerging && value < 5) return false;
        return true;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50) // Show up to 50 tags to ensure emerging topics are visible
      .map(([name, value]) => {
        const percentage = ((value / papers.length) * 100).toFixed(1);
        const isEmerging = !SUBJECT_TAGS.includes(name) && !ARCHITECTURE_TAGS.includes(name);
        return { 
          name, 
          value,
          percentage: `${percentage}%`,
          description: TOPIC_DESCRIPTIONS[name] || "A key research area in modern artificial intelligence.",
          isEmerging
        };
      });
  }, [papers]);

  const maxCount = useMemo(() => {
    return Math.max(...tagData.map(d => d.value), 0);
  }, [tagData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-red-500">Error loading data: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Research Trends</h1>
        <p className="text-muted-foreground">
          Analytics and insights from {papers.length} collected papers.
        </p>
      </div>

      {usingMockData && (
        <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-lg flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-4">
          <span className="text-lg">⚠️</span>
          <p className="text-sm font-medium">
            Backend connection failed. Displaying analytics for <span className="font-bold">offline demonstration data</span>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Growth Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Publication Frequency</CardTitle>
            <CardDescription>Number of papers published per month</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs" 
                  tick={{ fill: 'currentColor' }}
                  tickMargin={10}
                />
                <YAxis 
                  className="text-xs" 
                  tick={{ fill: 'currentColor' }}
                  tickMargin={10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    color: '#000'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="Papers" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  activeDot={{ r: 8 }} 
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Tags Bar Chart (Custom HTML Implementation for better text layout) */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Research Topics</CardTitle>
            <CardDescription>Most frequent research categories with detailed descriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {tagData.map((item, index) => (
                <div key={item.name} className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Label Side: Name & Description */}
                  <div className="sm:w-5/12 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm text-foreground">{item.name}</div>
                      {item.isEmerging && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-tight">
                          <TrendingUp className="h-2.5 w-2.5" />
                          Emerging
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground leading-snug">
                      {item.description}
                    </div>
                  </div>
                  
                  {/* Bar Side: Bar & Stats */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-4 bg-secondary/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${(item.value / maxCount) * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                    <div className="w-24 text-right flex flex-col items-end leading-none">
                      <span className="font-bold text-sm text-foreground">{item.value}</span>
                      <span className="text-[10px] text-muted-foreground">{item.percentage}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
