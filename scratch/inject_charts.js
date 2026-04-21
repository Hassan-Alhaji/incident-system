const fs = require('fs');

let c = fs.readFileSync('frontend/src/pages/oc/OCAnalytics.tsx', 'utf8');

if (!c.includes('recharts')) {
    c = c.replace('import {', 'import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from \'recharts\';\nimport {');
}

if (!c.includes('CATEGORY_COLORS')) {
    c = c.replace('return (', 'const CATEGORY_COLORS = [\'#3b82f6\', \'#f59e0b\', \'#10b981\', \'#8b5cf6\', \'#ec4899\', \'#06b6d4\', \'#64748b\'];\n  const CustomTooltip = ({ active, payload }: any) => { if (active && payload && payload.length) { return <div className="bg-slate-900 text-white text-xs p-2 rounded shadow-lg border border-slate-700"><p className="font-bold">{payload[0].name.replace(\'_\', \' \')}</p><p>{payload[0].value} {t(\'oc.analytics.tickets\', \'Tickets\')}</p></div>; } return null; };\n\n  return (');
}

const typeDistributionAnchor = '{/* Type Distribution */}';
const targetIndex = c.indexOf(typeDistributionAnchor);
if (targetIndex > -1) {
    const endDivs = '  </div>\n  </div>';
    const endIndex = c.indexOf(endDivs, targetIndex) + endDivs.length;
    
    // Also capture the end of the grid row containing it (which is another </div> after Type Distribution)
    const trueEndIndex = c.indexOf('</div>', endIndex) + 6;

    const newUI = `  {/* Category Distribution (Donut) */}
  <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm transition-shadow duration-200 p-4 flex flex-col">
    <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
      <BarChart3 size={14} className="text-blue-500" /> Category Distribution
    </h3>
    <div className="flex-1 min-h-[220px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={Object.entries(data.typeDistribution || {}).map(([name, value]) => ({ name, value }))}
            cx="50%" cy="50%"
            innerRadius={65} outerRadius={85}
            paddingAngle={8}
            dataKey="value"
            stroke="none"
          >
            {Object.entries(data.typeDistribution || {}).map((entry, index) => (
              <Cell key={\`cell-\${index}\`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
        <span className="text-3xl font-black text-slate-900 leading-none">{data.totalTickets}</span>
        <span className="text-[10px] font-bold text-slate-400 tracking-widest mt-1">TOTAL</span>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {Object.entries(data.typeDistribution || {}).map(([name, value], index) => (
        <div key={name} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}></span>
          {t(\`oc.incidentTypes.\${name}\`, name)}
        </div>
      ))}
    </div>
  </div>
</div>

{/* Incident Hotspots */}
<div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm transition-shadow duration-200 p-4 mt-4">
  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
    <MapPin size={14} className="text-red-500" /> Incident Hotspots (Top Locations)
  </h3>
  {data.topLocations && data.topLocations.length > 0 ? (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.topLocations} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} />
          <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
          <Bar dataKey="count" fill="url(#colorMap)" radius={[0, 8, 8, 0]} barSize={24} />
          <defs>
            <linearGradient id="colorMap" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <div className="min-h-[150px] flex items-center justify-center text-sm font-medium text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
      No location data mapped yet
    </div>
  )}
</div>`;

    c = c.substring(0, targetIndex) + newUI + c.substring(trueEndIndex);
    fs.writeFileSync('frontend/src/pages/oc/OCAnalytics.tsx', c);
    console.log('Successfully injected Recharts elements into OCAnalytics');
} else {
    console.log('Type Distribution block not found');
}
