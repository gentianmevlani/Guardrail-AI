'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export const DotScreenShader = () => {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="absolute inset-0 bg-black" />
  }

  return (
    <div className="absolute inset-0 bg-black">
      {/* Simple dot pattern background */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, ${theme === 'light' ? '#000' : '#60A5FA'} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 70% 110%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
        }}
      />
    </div>
  )
}
