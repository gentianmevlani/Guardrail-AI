export interface AppNotification {
  id: string;
  type: "security" | "compliance" | "billing" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface HealthScore {
  overall: number;
  security: number;
  quality: number;
  performance: number;
}

export async function logout() {
  // Mock logout function
  await new Promise((resolve) => setTimeout(resolve, 500));
  // In a real app, this would call the API and clear tokens
  console.log("User logged out");
}

export async function fetchHealthScore(): Promise<HealthScore> {
  // Mock health score function - returns random scores for demo
  await new Promise((resolve) => setTimeout(resolve, 100));
  
  return {
    overall: Math.floor(Math.random() * 20) + 75, // 75-95
    security: Math.floor(Math.random() * 20) + 70, // 70-90
    quality: Math.floor(Math.random() * 20) + 80, // 80-100
    performance: Math.floor(Math.random() * 20) + 75, // 75-95
  };
}