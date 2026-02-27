import type { ComponentType, SVGProps } from 'react'
import { DE, ES, FR, GB, IT } from 'country-flag-icons/react/3x2'
import { LANGUAGE_META, type LanguageCode } from '../lib/languages'

type FlagComponent = ComponentType<SVGProps<SVGSVGElement>>

const FLAG_MAP: Record<(typeof LANGUAGE_META)[LanguageCode]['countryCode'], FlagComponent> = {
  IT,
  GB,
  ES,
  FR,
  DE,
}

type FlagIconProps = {
  language: LanguageCode
  className?: string
}

function FlagIcon({ language, className = 'h-4 w-6 rounded-sm' }: FlagIconProps) {
  const countryCode = LANGUAGE_META[language].countryCode
  const Component = FLAG_MAP[countryCode]
  return <Component className={className} />
}

export default FlagIcon
