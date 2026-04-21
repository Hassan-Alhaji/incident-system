import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface RiskAssessmentMatrixProps {
 likelihood: number | null;
 consequence: number | null;
 onChange: (score: { likelihood: number, consequence: number, score: number, level: string }) => void;
 readonly?: boolean;
}

const RiskAssessmentMatrix: React.FC<RiskAssessmentMatrixProps> = ({ likelihood, consequence, onChange, readonly = false }) => {
 const [l, setL] = useState<number | null>(likelihood);
 const [c, setC] = useState<number | null>(consequence);

 useEffect(() => {
 setL(likelihood);
 setC(consequence);
 }, [likelihood, consequence]);

 // Matrix definition
 // Columns (1-5): Negligible, Minor, Moderate, Major, Catastrophic (Consequence)
 // Rows (1-5): Rare, Unlikely, Possible, Likely, Almost Certain (Likelihood)
 
 const calculateRisk = (currentL: number, currentC: number) => {
 const score = currentL * currentC;
 let level = 'LOW';
 if (score >= 5 && score <= 9) level = 'MEDIUM';
 if (score >= 10 && score <= 14) level = 'HIGH';
 if (score >= 15) level = 'EXTREME';
 return { score, level };
 };

 const handleSelect = (selectedL: number, selectedC: number) => {
 if (readonly) return;
 setL(selectedL);
 setC(selectedC);
 const result = calculateRisk(selectedL, selectedC);
 onChange({ likelihood: selectedL, consequence: selectedC, ...result });
 };

 const getCellColor = (rowL: number, colC: number) => {
 const score = rowL * colC;
 if (score <= 4) return 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-200';
 if (score <= 9) return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-200';
 if (score <= 14) return 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-200';
 return 'bg-red-100 hover:bg-red-200 text-red-800 border-red-200';
 };

 const levels = [5, 4, 3, 2, 1]; // Likelihood (y-axis descending)
 const columns = [1, 2, 3, 4, 5]; // Consequence (x-axis)

 const likelihoodLabels = { 5: 'Almost Certain', 4: 'Likely', 3: 'Possible', 2: 'Unlikely', 1: 'Rare' };
 const consequenceLabels = { 1: 'Negligible', 2: 'Minor', 3: 'Moderate', 4: 'Major', 5: 'Catastrophic' };

 const currentResult = (l && c) ? calculateRisk(l, c) : null;

 return (
 <div className="bg-white border text-base border-gray-200 rounded-xl shadow-sm overflow-hidden p-4">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600"><AlertTriangle size={16} /></div>
 <h3 className="text-gray-900 font-bold tracking-tight">Risk Assessment (L x C)</h3>
 </div>
 {currentResult && (
 <div className={`px-3 py-1 rounded-full text-base font-bold border flex items-center gap-2
 ${currentResult.level === 'LOW' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
 ${currentResult.level === 'MEDIUM' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}
 ${currentResult.level === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
 ${currentResult.level === 'EXTREME' ? 'bg-red-50 text-red-700 border-red-200' : ''}
 `}>
 <ShieldCheck size={14} /> Score: {currentResult.score} / {currentResult.level}
 </div>
 )}
 </div>

 <div className="overflow-x-auto">
 <table className="w-full min-w-[500px]">
 <thead>
 <tr>
 <th className="bg-gray-50 p-2 text-base text-gray-500 font-medium whitespace-nowrap text-right pr-4 border-r border-b border-gray-200">Likelihood \ Consequence</th>
 {columns.map(col => (
 <th key={col} className="bg-gray-50 border-b border-gray-200 p-2 text-center text-[10px] font-bold text-gray-600 uppercase w-1/5 whitespace-nowrap">
 {col} - {consequenceLabels[col as keyof typeof consequenceLabels]}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {levels.map(row => (
 <tr key={row}>
 <td className="p-2 border-r border-b border-gray-200 text-right pr-4 bg-gray-50 text-[10px] font-bold text-gray-600 uppercase whitespace-nowrap">
 {row} - {likelihoodLabels[row as keyof typeof likelihoodLabels]}
 </td>
 {columns.map(col => {
 const isSelected = l === row && c === col;
 const score = row * col;
 return (
 <td 
 key={col} 
 onClick={() => handleSelect(row, col)}
 className={`p-0 border-b border-r border-gray-100 ${readonly ? 'cursor-default' : 'cursor-pointer'} transition-all`}
 >
 <div className={`w-full h-full min-h-[40px] flex items-center justify-center font-bold text-base border-2 
 ${getCellColor(row, col)} 
 ${isSelected ? 'border-gray-900 shadow-inner scale-[0.98]' : 'border-transparent'}
 `}>
 {score}
 </div>
 </td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {!readonly && (
 <p className="text-[10px] text-gray-400 mt-3 text-center uppercase tracking-widest font-bold">
 Select a square to assign risk severity
 </p>
 )}
 </div>
 );
};

export default RiskAssessmentMatrix;
