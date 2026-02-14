import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Shield, AlertTriangle, AlertOctagon } from 'lucide-react'

interface StrengthMeterProps {
  password: string
  showEntropy?: boolean
}

type StrengthLevel = 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong'

interface StrengthInfo {
  level: StrengthLevel
  label: string
  color: string
  icon: typeof Shield | typeof AlertTriangle | typeof AlertOctagon
}

function getStrengthInfo(score: number): StrengthInfo {
  if (score === 0) {
    return {
      level: 'very-weak',
      label: 'Very Weak',
      color: '#ff4d4d',
      icon: AlertOctagon
    }
  }
  if (score === 1) {
    return {
      level: 'weak',
      label: 'Weak',
      color: '#ffa500',
      icon: AlertTriangle
    }
  }
  if (score === 2) {
    return {
      level: 'fair',
      label: 'Fair',
      color: '#ffcc00',
      icon: AlertTriangle
    }
  }
  if (score === 3) {
    return {
      level: 'strong',
      label: 'Strong',
      color: '#90ee90',
      icon: Shield
    }
  }
  return {
    level: 'very-strong',
    label: 'Very Strong',
    color: '#00ff9d',
    icon: Shield
  }
}

export default function StrengthMeter({ password, showEntropy = false }: StrengthMeterProps) {
  const [analysis, setAnalysis] = useState<{
    score: number
    entropy: number
  }>({ score: 0, entropy: 0 })

  useEffect(() => {
    if (!password) {
      setAnalysis({ score: 0, entropy: 0 })
      return
    }

    const analyzePassword = async () => {
      try {
        const result = await invoke('analyze_password_strength', { password })
        const data = JSON.parse(result as string)
        setAnalysis({
          score: data.score,
          entropy: data.entropy
        })
      } catch (error) {
        console.error('Error analyzing password:', error)
      }
    }

    const timer = setTimeout(analyzePassword, 150)
    return () => clearTimeout(timer)
  }, [password])

  if (!password) {
    return null
  }

  const strengthInfo = getStrengthInfo(analysis.score)
  const Icon = strengthInfo.icon
  const percentage = ((analysis.score + 1) / 5) * 100

  return (
    <div className="strength-meter">
      <div className="strength-header">
        <div className="strength-info">
          <Icon size={14} style={{ color: strengthInfo.color }} />
          <span className="strength-label" style={{ color: strengthInfo.color }}>
            {strengthInfo.label}
          </span>
          {showEntropy && (
            <span className="strength-entropy">
              {Math.round(analysis.entropy)}-bit
            </span>
          )}
        </div>
      </div>
      <div className="strength-bar-container">
        <div
          className="strength-bar"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, 
              #ff4d4d 0%, 
              #ffa500 25%, 
              #ffcc00 50%, 
              #90ee90 75%, 
              ${strengthInfo.color} 100%)`
          }}
        />
      </div>
    </div>
  )
}
