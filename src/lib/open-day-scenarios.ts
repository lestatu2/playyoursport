import type { PublicSession } from './auth'
import {
  getOpenDayMinorAthletesByProspectId,
  getOpenDayParticipationsByProspectId,
  getOpenDayProspectByUserId,
} from './open-day-records'
import type { OpenDayAudience, OpenDayEdition, OpenDayProduct } from './open-day-catalog'
import { getPublicClients, getPublicMinors } from './public-customer-records'

export type OpenDayScenario =
  | 'guest_adult_self_new'
  | 'guest_youth_minor_new'
  | 'prospect_adult_self_repeat_or_new'
  | 'prospect_youth_existing_minor_new_open_day'
  | 'prospect_youth_new_minor'
  | 'client_adult_self_repeat_or_new'
  | 'client_youth_existing_minor_new_open_day'
  | 'client_youth_new_minor'
  | 'unsupported'

export type OpenDayScenarioConfig = {
  scenario: OpenDayScenario
  audience: OpenDayAudience
  isGuest: boolean
  requiresAccountStep: boolean
  requiresGuardianStep: boolean
  requiresParticipantStep: boolean
  canSelectExistingMinor: boolean
  canCreateNewMinor: boolean
  shouldPromptForExistingDataReuse: boolean
  shouldSkipGuardianForValidatedProfile: boolean
  existingMinorCount: number
  priorOpenDayParticipationCount: number
}

type ResolveOpenDayScenarioInput = {
  product: OpenDayProduct | null
  edition?: OpenDayEdition | null
  session: PublicSession | null
}

function createConfig(
  scenario: OpenDayScenario,
  audience: OpenDayAudience,
  overrides: Partial<Omit<OpenDayScenarioConfig, 'scenario' | 'audience'>>,
): OpenDayScenarioConfig {
  return {
    scenario,
    audience,
    isGuest: false,
    requiresAccountStep: true,
    requiresGuardianStep: audience === 'youth',
    requiresParticipantStep: true,
    canSelectExistingMinor: false,
    canCreateNewMinor: audience === 'youth',
    shouldPromptForExistingDataReuse: false,
    shouldSkipGuardianForValidatedProfile: false,
    existingMinorCount: 0,
    priorOpenDayParticipationCount: 0,
    ...overrides,
  }
}

function getClientMinorCount(userId: number): number {
  const clientIds = new Set(getPublicClients().filter((item) => item.userId === userId).map((item) => item.id))
  return getPublicMinors().filter((item) => clientIds.has(item.clientId)).length
}

export function resolveOpenDayScenario({
  product,
  session,
}: ResolveOpenDayScenarioInput): OpenDayScenarioConfig {
  if (!product) {
    return createConfig('unsupported', 'youth', {
      isGuest: true,
      requiresAccountStep: false,
      requiresGuardianStep: false,
      requiresParticipantStep: false,
      canCreateNewMinor: false,
    })
  }

  const audience = product.audience
  if (!session) {
    return createConfig(audience === 'adult' ? 'guest_adult_self_new' : 'guest_youth_minor_new', audience, {
      isGuest: true,
      requiresAccountStep: true,
      requiresGuardianStep: audience === 'youth',
      requiresParticipantStep: true,
      canCreateNewMinor: audience === 'youth',
    })
  }

  if (session.role === 'prospect') {
    const prospect = getOpenDayProspectByUserId(session.userId)
    const existingMinorCount = prospect ? getOpenDayMinorAthletesByProspectId(prospect.id).length : 0
    const priorOpenDayParticipationCount = prospect ? getOpenDayParticipationsByProspectId(prospect.id).length : 0
    if (audience === 'adult') {
      return createConfig('prospect_adult_self_repeat_or_new', audience, {
        requiresAccountStep: prospect === null,
        requiresGuardianStep: false,
        requiresParticipantStep: true,
        shouldPromptForExistingDataReuse: prospect !== null,
        shouldSkipGuardianForValidatedProfile: prospect?.validationStatus === 'validated',
        existingMinorCount,
        priorOpenDayParticipationCount,
      })
    }
    if (existingMinorCount > 0) {
      return createConfig('prospect_youth_existing_minor_new_open_day', audience, {
        requiresAccountStep: prospect === null,
        requiresGuardianStep: prospect === null,
        requiresParticipantStep: true,
        canSelectExistingMinor: true,
        canCreateNewMinor: true,
        shouldPromptForExistingDataReuse: true,
        shouldSkipGuardianForValidatedProfile: prospect?.validationStatus === 'validated',
        existingMinorCount,
        priorOpenDayParticipationCount,
      })
    }
    return createConfig('prospect_youth_new_minor', audience, {
      requiresAccountStep: prospect === null,
      requiresGuardianStep: prospect === null,
      requiresParticipantStep: true,
      canSelectExistingMinor: false,
      canCreateNewMinor: true,
      shouldSkipGuardianForValidatedProfile: prospect?.validationStatus === 'validated',
      existingMinorCount,
      priorOpenDayParticipationCount,
    })
  }

  if (session.role === 'client') {
    const existingMinorCount = audience === 'youth' ? getClientMinorCount(session.userId) : 0
    if (audience === 'adult') {
      return createConfig('client_adult_self_repeat_or_new', audience, {
        requiresAccountStep: false,
        requiresGuardianStep: false,
        requiresParticipantStep: true,
        shouldPromptForExistingDataReuse: true,
        shouldSkipGuardianForValidatedProfile: true,
        existingMinorCount,
      })
    }
    if (existingMinorCount > 0) {
      return createConfig('client_youth_existing_minor_new_open_day', audience, {
        requiresAccountStep: false,
        requiresGuardianStep: false,
        requiresParticipantStep: true,
        canSelectExistingMinor: true,
        canCreateNewMinor: true,
        shouldPromptForExistingDataReuse: true,
        shouldSkipGuardianForValidatedProfile: true,
        existingMinorCount,
      })
    }
    return createConfig('client_youth_new_minor', audience, {
      requiresAccountStep: false,
      requiresGuardianStep: false,
      requiresParticipantStep: true,
      canSelectExistingMinor: false,
      canCreateNewMinor: true,
      shouldSkipGuardianForValidatedProfile: true,
      existingMinorCount,
    })
  }

  return createConfig('unsupported', audience, {
    requiresAccountStep: false,
    requiresGuardianStep: false,
    requiresParticipantStep: false,
    canCreateNewMinor: false,
  })
}
