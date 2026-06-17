import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { GAME_CONFIG } from '../game/fishLogic'

function FishGraph({ verlauf, maxFisch }) {
  const yMax = maxFisch || GAME_CONFIG.maxFischbestand
  if (verlauf.length === 0) return (
    <div className="w-full h-full bg-white/10 rounded-xl flex items-center justify-center text-blue-400 text-sm">
      No data yet – complete the first round
    </div>
  )

  return (
    <div className="w-full h-full bg-white/10 rounded-xl p-3 text-white flex flex-col">
      <div className="flex-none text-sm font-bold mb-1">Fish Stock History</div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={verlauf} margin={{ top: 5, right: 15, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="runde"
              stroke="rgba(255,255,255,0.5)"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.5)"
              domain={[0, yMax]}
              tick={{ fontSize: 10 }}
              tickFormatter={v => v.toLocaleString()}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: 11 }}
              formatter={v => [`${v.toLocaleString()} fish`, 'Stock']}
            />
            <Line
              type="monotone"
              dataKey="fischbestand"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={false}
              name="Fish Stock"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default FishGraph
