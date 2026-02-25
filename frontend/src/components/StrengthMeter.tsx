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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!password || password === 'Generating...') {
      setAnalysis({ score: 0, entropy: 0 })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
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
        setAnalysis({ score: 0, entropy: 0 })
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(analyzePassword, 300)
    return () => clearTimeout(timer)
  }, [password])

  if (!password || password === 'Generating...') {
    return null
  }

  const strengthInfo = getStrengthInfo(analysis.score)
  const Icon = strengthInfo.icon

  return (
    <div className="strength-meter" style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
      <div className="strength-meter-info">
        <Icon size={14} style={{ color: strengthInfo.color }} />
        <span className="strength-meter-label" style={{ color: strengthInfo.color }}>
          {strengthInfo.label}
        </span>
        {showEntropy && !isNaN(analysis.entropy) && (
          <span className="strength-meter-entropy">
            {Math.round(analysis.entropy)}-bit
          </span>
        )}
      </div>
      <div className="strength-meter-bar">
        <div className={`strength-meter-fill ${strengthInfo.level}`} />
      </div>
    </div>
  )
}
