import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function FishGraph({ verlauf }) {
  if (verlauf.length === 0) return null

  return (
    <div className="bg-white/10 rounded-2xl p-6 text-white mb-6">
      <h2 className="font-bold text-lg mb-4">📈 Fischbestand Verlauf</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={verlauf}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="runde" 
            stroke="rgba(255,255,255,0.5)"
            label={{ value: 'Runde', position: 'insideBottom', fill: 'rgba(255,255,255,0.5)' }}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.5)"
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px' }}
          />
          <Line 
            type="monotone" 
            dataKey="fischbestand" 
            stroke="#22c55e" 
            strokeWidth={2}
            dot={{ fill: '#22c55e' }}
            name="Fischbestand %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default FishGraph