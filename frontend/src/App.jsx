import { useState } from 'react'
import ScanScreen from './screens/ScanScreen'
import ResultsScreen from './screens/ResultsScreen'
import CheckoutScreen from './screens/CheckoutScreen'
import TrackingScreen from './screens/TrackingScreen'
import HistoryScreen from './screens/HistoryScreen'
import CalorieTracker from './components/CalorieTracker'
import { useCalorieTracker } from './hooks/useCalorieTracker'

export default function App() {
  const [screen, setScreen] = useState('scan')
  const [result, setResult] = useState(null)
  const [cart, setCart] = useState(null)
  const [order, setOrder] = useState(null)
  const calorieTracker = useCalorieTracker()

  function handleResult(nextResult) {
    setResult(nextResult)
    setScreen('results')
  }

  function handleCheckout(nextCart) {
    setCart(nextCart)
    setScreen('checkout')
  }

  function handleOrder(nextOrder) {
    const quantity = nextOrder.itemCount || 0

    if (result?.calories && quantity > 0) {
      calorieTracker.addEntry({
        dish: result.dish,
        quantity,
        calories: result.calories * quantity,
        macros: scaleMacros(result.macros, quantity),
        restaurant: nextOrder.restaurant?.name,
        orderId: nextOrder.orderId
      })
    }
    setOrder({
      ...nextOrder,
      dish: result?.dish,
      itemCount: quantity
    })
    setScreen('tracking')
  }

  function handleDone() {
    setResult(null)
    setCart(null)
    setOrder(null)
    setScreen('scan')
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" type="button" onClick={handleDone} aria-label="Go to scan screen">
          <span className="brand-mark">S</span>
          <span>SnapOrder</span>
        </button>
        <CalorieTracker
          total={calorieTracker.total}
          itemCount={calorieTracker.itemCount}
          macros={calorieTracker.macros}
          entries={calorieTracker.entries}
          onClear={calorieTracker.clearToday}
          onViewHistory={() => setScreen('history')}
        />
      </header>

      <main className="screen-shell">
        {screen === 'scan' && <ScanScreen onResult={handleResult} />}
        {screen === 'results' && (
          <ResultsScreen
            result={result}
            onCheckout={handleCheckout}
            onBack={() => setScreen('scan')}
          />
        )}
        {screen === 'checkout' && (
          <CheckoutScreen
            cart={cart}
            result={result}
            onCartChange={setCart}
            onOrder={handleOrder}
            onBack={() => setScreen('results')}
          />
        )}
        {screen === 'tracking' && <TrackingScreen order={order} onDone={handleDone} />}
        {screen === 'history' && (
          <HistoryScreen
            entries={calorieTracker.entries}
            total={calorieTracker.total}
            macros={calorieTracker.macros}
            onClear={calorieTracker.clearToday}
            onBack={() => setScreen('scan')}
          />
        )}
      </main>
    </div>
  )
}

function scaleMacros(macros, quantity) {
  if (!macros) return null
  return {
    carbs: macros.carbs * quantity,
    protein: macros.protein * quantity,
    fat: macros.fat * quantity
  }
}
