import { spawn } from 'child_process';
import { icons, styles } from '../ui/cli-styles';

export async function installPlaywrightDependencies(projectPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`  ${styles.brightCyan}${icons.info} Installing Playwright...${styles.reset}`);
    
    // Install @playwright/test
    await new Promise<void>((resolve, reject) => {
      const npmInstall = spawn('npm', ['install', '-D', '@playwright/test'], {
        cwd: projectPath,
        stdio: 'pipe'
      });
      
      npmInstall.on('close', (code) => {
        if (code === 0) {
          console.log(`  ${styles.brightGreen}${icons.success} Playwright package installed${styles.reset}`);
          resolve();
        } else {
          reject(new Error('npm install failed'));
        }
      });
      
      npmInstall.on('error', reject);
    });
    
    // Install browsers
    console.log(`  ${styles.brightCyan}${icons.info} Installing Playwright browsers...${styles.reset}`);
    await new Promise<void>((resolve, reject) => {
      const browserInstall = spawn('npx', ['playwright', 'install'], {
        cwd: projectPath,
        stdio: 'pipe'
      });
      
      browserInstall.on('close', (code) => {
        if (code === 0) {
          console.log(`  ${styles.brightGreen}${icons.success} Playwright browsers installed${styles.reset}`);
          resolve();
        } else {
          reject(new Error('browser install failed'));
        }
      });
      
      browserInstall.on('error', reject);
    });
    
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
