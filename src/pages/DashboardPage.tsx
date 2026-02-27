import { useTranslation } from 'react-i18next'

function DashboardPage() {
  const { t } = useTranslation()

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{t('dashboard.title')}</h2>
        <p className="text-sm opacity-70">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card h-32 border border-dashed border-base-300 bg-base-100 shadow-sm" />
        <div className="card h-32 border border-dashed border-base-300 bg-base-100 shadow-sm" />
        <div className="card h-32 border border-dashed border-base-300 bg-base-100 shadow-sm" />
        <div className="card h-32 border border-dashed border-base-300 bg-base-100 shadow-sm" />
      </div>

      <div className="card border border-dashed border-base-300 bg-base-100 shadow-sm">
        <div className="card-body h-72" />
      </div>
    </section>
  )
}

export default DashboardPage
