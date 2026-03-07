import { useTranslation } from 'react-i18next'

function UtilityContractsPage() {
  const { t } = useTranslation()

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{t('utility.contracts.title')}</h2>
        <p className="text-sm opacity-70">{t('utility.contracts.description')}</p>
      </div>
    </section>
  )
}

export default UtilityContractsPage
