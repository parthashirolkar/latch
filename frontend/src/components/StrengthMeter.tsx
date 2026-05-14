import { useState, useEffect } from 'react'
import { api } from '../api/client'
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
        const report = await api.analyzePassword(password)
        setAnalysis({
          score: report.score,
          entropy: report.entropy
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
    <div className="mt-2" style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
      <div className="flex items-center gap-2 mt-2.5">
        <Icon size={14} style={{ color: strengthInfo.color }} />
        <span className="text-sm font-medium text-white/80" style={{ color: strengthInfo.color }}>
          {strengthInfo.label}
        </span>
        {showEntropy && !isNaN(analysis.entropy) && (
          <span className="font-mono text-xs text-brutal-gray ml-2">
            {Math.round(analysis.entropy)}-bit
          </span>
        )}
      </div>
      <div className="h-1 bg-[#111] rounded overflow-hidden relative mt-1">
        <div
          className={`h-full rounded transition-all duration-300 ${
            strengthInfo.level === 'very-weak' ? 'bg-[#ff4d4d] w-[20%]' :
            strengthInfo.level === 'weak' ? 'bg-[#ffa500] w-[40%]' :
            strengthInfo.level === 'fair' ? 'bg-[#ffcc00] w-[60%]' :
            strengthInfo.level === 'strong' ? 'bg-[#90ee90] w-[80%]' :
            'bg-[#00ff9d] w-full'
          }`}
        />
      </div>
    </div>
  )
}
