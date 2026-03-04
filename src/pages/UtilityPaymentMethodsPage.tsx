import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getPaymentMethods,
  getPaymentMethodsChangedEventName,
  updatePaymentMethodActive,
  type PaymentMethod,
  type PaymentMethodCode,
} from '../lib/payment-methods'

const PAYMENT_METHOD_ORDER: PaymentMethodCode[] = ['onsite_pos', 'bank_transfer', 'paypal']

function UtilityPaymentMethodsPage() {
  const { t } = useTranslation()
  const [methods, setMethods] = useState<PaymentMethod[]>(() => getPaymentMethods())
  const [openDescriptionCode, setOpenDescriptionCode] = useState<PaymentMethodCode | null>(null)
  const [message, setMessage] = useState('')
  const paymentMethodsEvent = getPaymentMethodsChangedEventName()

  useEffect(() => {
    const handleChange = () => setMethods(getPaymentMethods())
    window.addEventListener(paymentMethodsEvent, handleChange)
    return () => window.removeEventListener(paymentMethodsEvent, handleChange)
  }, [paymentMethodsEvent])

  const toggleMethod = (code: PaymentMethodCode, checked: boolean) => {
    setMethods(updatePaymentMethodActive(code, checked))
    setMessage(t('utility.paymentMethods.updated'))
  }

  const methodsByCode = new Map(methods.map((item) => [item.code, item]))

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{t('utility.paymentMethods.title')}</h2>
        <p className="text-sm opacity-70">{t('utility.paymentMethods.description')}</p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{message}</p> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PAYMENT_METHOD_ORDER.map((code) => {
              const item = methodsByCode.get(code)
              if (!item) {
                return null
              }
              return (
                <div key={code} className="h-full">
                  <div className="flex h-full flex-col rounded-lg border border-base-300">
                    <label className="label min-h-20 cursor-pointer justify-between gap-4 px-3 py-3">
                      <span className="label-text">
                        <span className="block font-medium">{t(`utility.paymentMethods.methods.${code}.label`)}</span>
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        checked={item.isActive}
                        onChange={(event) => toggleMethod(code, event.target.checked)}
                        aria-label={t(`utility.paymentMethods.methods.${code}.label`)}
                      />
                    </label>
                    <div
                      className={`collapse collapse-arrow mt-auto border-t border-base-300 bg-base-100 ${
                        openDescriptionCode === code ? 'collapse-open' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="collapse-title py-2 text-left text-sm font-medium"
                        onClick={() => setOpenDescriptionCode((prev) => (prev === code ? null : code))}
                      >
                        {t('utility.paymentMethods.methodDescriptionTitle')}
                      </button>
                      <div className="collapse-content text-sm leading-relaxed">
                        {t(`utility.paymentMethods.methods.${code}.help`)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default UtilityPaymentMethodsPage
