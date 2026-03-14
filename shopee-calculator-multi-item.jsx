import React, { useState, useEffect } from 'react';
import { Settings, Calculator, Save, TrendingUp, Package } from 'lucide-react';

const ShopeeProfitCalculator = () => {
  // --- State Definitions ---
  
  // Basic Inputs
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [domesticShipping, setDomesticShipping] = useState(0);
  const [shippingZone, setShippingZone] = useState('A');
  
  // Multi-item Purchase (New!)
  const [quantity, setQuantity] = useState(1);
  const [enableMultiItem, setEnableMultiItem] = useState(false);

  // General Settings
  const [exchangeRate, setExchangeRate] = useState(2.65);
  const [transactionFeeRate, setTransactionFeeRate] = useState(2.24);
  const [payoneerFeeRate, setPayoneerFeeRate] = useState(2.0);
  
  // Tax Settings
  const [consumptionTaxRate, setConsumptionTaxRate] = useState(10);
  const [enableTaxRefund, setEnableTaxRefund] = useState(true);
  
  // Program Settings
  const [isNewSeller, setIsNewSeller] = useState(false);
  const [commissionFeeRate, setCommissionFeeRate] = useState(5.0);
  
  const [enableFSS, setEnableFSS] = useState(true);
  const [fssRate, setFssRate] = useState(5.6);
  
  const [enableCCB, setEnableCCB] = useState(false);
  const [ccbRate, setCcbRate] = useState(3.36);
  
  const [enableMDV, setEnableMDV] = useState(false);
  const [mdvRate, setMdvRate] = useState(4.0);

  const [showSettings, setShowSettings] = useState(false);

  // --- Shipping Table Data ---
  const getShippingData = (weightInGrams, zone) => {
    const roundedWeight = Math.ceil(weightInGrams / 50) * 50;
    
    const rates = {
      50: { A: 56, B: 76, C: 106, D: 106, ESF: 50 },
      100: { A: 81, B: 101, C: 131, D: 131, ESF: 50 },
      150: { A: 106, B: 126, C: 156, D: 156, ESF: 50 },
      200: { A: 131, B: 151, C: 181, D: 181, ESF: 50 },
      250: { A: 156, B: 176, C: 206, D: 206, ESF: 50 },
      300: { A: 181, B: 201, C: 231, D: 231, ESF: 50 },
      350: { A: 206, B: 226, C: 256, D: 256, ESF: 50 },
      400: { A: 231, B: 251, C: 281, D: 281, ESF: 50 },
      450: { A: 256, B: 276, C: 306, D: 306, ESF: 50 },
      500: { A: 281, B: 301, C: 331, D: 331, ESF: 50 },
      550: { A: 306, B: 326, C: 356, D: 356, ESF: 50 },
      600: { A: 331, B: 351, C: 381, D: 381, ESF: 50 },
      650: { A: 356, B: 376, C: 406, D: 406, ESF: 50 },
      700: { A: 381, B: 401, C: 431, D: 431, ESF: 50 },
      750: { A: 406, B: 426, C: 456, D: 456, ESF: 50 },
      800: { A: 431, B: 451, C: 481, D: 481, ESF: 50 },
      850: { A: 456, B: 476, C: 506, D: 506, ESF: 50 },
      900: { A: 481, B: 501, C: 531, D: 531, ESF: 50 },
      950: { A: 506, B: 526, C: 556, D: 556, ESF: 50 },
      1000: { A: 531, B: 551, C: 581, D: 581, ESF: 50 },
      1050: { A: 556, B: 576, C: 606, D: 606, ESF: 50 },
      1100: { A: 581, B: 601, C: 631, D: 631, ESF: 50 },
      1150: { A: 606, B: 626, C: 656, D: 656, ESF: 50 },
      1200: { A: 631, B: 651, C: 681, D: 681, ESF: 50 },
      1250: { A: 656, B: 676, C: 706, D: 706, ESF: 50 },
      1300: { A: 681, B: 701, C: 731, D: 731, ESF: 50 },
      1350: { A: 706, B: 726, C: 756, D: 756, ESF: 50 },
      1400: { A: 731, B: 751, C: 781, D: 781, ESF: 50 },
      1450: { A: 756, B: 776, C: 806, D: 806, ESF: 50 },
      1500: { A: 781, B: 801, C: 831, D: 831, ESF: 50 },
      1550: { A: 806, B: 826, C: 856, D: 856, ESF: 50 },
      1600: { A: 831, B: 851, C: 881, D: 881, ESF: 50 },
      1650: { A: 856, B: 876, C: 906, D: 906, ESF: 50 },
      1700: { A: 881, B: 901, C: 931, D: 931, ESF: 50 },
      1750: { A: 906, B: 926, C: 956, D: 956, ESF: 50 },
      1800: { A: 931, B: 951, C: 981, D: 981, ESF: 50 },
      1850: { A: 956, B: 976, C: 1006, D: 1006, ESF: 50 },
      1900: { A: 981, B: 1001, C: 1031, D: 1031, ESF: 50 },
      1950: { A: 1006, B: 1026, C: 1056, D: 1056, ESF: 50 },
      2000: { A: 1031, B: 1051, C: 1081, D: 1081, ESF: 50 },
      2050: { A: 1056, B: 1076, C: 1106, D: 1106, ESF: 50 },
      2100: { A: 1081, B: 1101, C: 1131, D: 1131, ESF: 50 },
      2150: { A: 1106, B: 1126, C: 1156, D: 1156, ESF: 50 },
      2200: { A: 1131, B: 1151, C: 1181, D: 1181, ESF: 50 },
      2250: { A: 1156, B: 1176, C: 1206, D: 1206, ESF: 50 },
      2300: { A: 1181, B: 1201, C: 1231, D: 1231, ESF: 50 },
      2350: { A: 1206, B: 1226, C: 1256, D: 1256, ESF: 50 },
      2400: { A: 1231, B: 1251, C: 1281, D: 1281, ESF: 50 },
      2450: { A: 1256, B: 1276, C: 1306, D: 1306, ESF: 50 },
      2500: { A: 1281, B: 1301, C: 1331, D: 1331, ESF: 50 },
      2550: { A: 1306, B: 1326, C: 1356, D: 1356, ESF: 50 },
      2600: { A: 1331, B: 1351, C: 1381, D: 1381, ESF: 50 },
      2650: { A: 1356, B: 1376, C: 1406, D: 1406, ESF: 50 },
      2700: { A: 1381, B: 1401, C: 1431, D: 1431, ESF: 50 },
      2750: { A: 1406, B: 1426, C: 1456, D: 1456, ESF: 50 },
      2800: { A: 1431, B: 1451, C: 1481, D: 1481, ESF: 50 },
      2850: { A: 1456, B: 1476, C: 1506, D: 1506, ESF: 50 },
      2900: { A: 1481, B: 1501, C: 1531, D: 1531, ESF: 50 },
      2950: { A: 1506, B: 1526, C: 1556, D: 1556, ESF: 50 },
      3000: { A: 1531, B: 1551, C: 1581, D: 1581, ESF: 50 },
    };

    if (roundedWeight > 3000) {
      const base3000 = rates[3000][zone];
      const additionalSteps = (roundedWeight - 3000) / 50;
      const actualFee = base3000 + (additionalSteps * 25);
      return { actualFee, esfAmount: 50 };
    }

    const data = rates[roundedWeight];
    return data ? { actualFee: data[zone], esfAmount: data.ESF } : { actualFee: 0, esfAmount: 0 };
  };

  // --- Effects ---

  useEffect(() => {
    const savedSettings = localStorage.getItem('shopeeCalcSettings_v5');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setExchangeRate(parsed.exchangeRate ?? 2.65);
      setTransactionFeeRate(parsed.transactionFeeRate ?? 2.24);
      setPayoneerFeeRate(parsed.payoneerFeeRate ?? 2.0);
      
      setConsumptionTaxRate(parsed.consumptionTaxRate ?? 10);
      setEnableTaxRefund(parsed.enableTaxRefund ?? true);
      
      setIsNewSeller(parsed.isNewSeller ?? false);
      setCommissionFeeRate(parsed.commissionFeeRate ?? 5.0);
      
      setEnableFSS(parsed.enableFSS ?? true);
      setFssRate(parsed.fssRate ?? 5.6);
      
      setEnableCCB(parsed.enableCCB ?? false);
      setCcbRate(parsed.ccbRate ?? 3.36);
      
      setEnableMDV(parsed.enableMDV ?? false);
      setMdvRate(parsed.mdvRate ?? 4.0);

      setShippingZone(parsed.shippingZone ?? 'A');
    }
  }, []);

  const saveSettings = () => {
    const settings = {
      exchangeRate,
      transactionFeeRate,
      payoneerFeeRate,
      consumptionTaxRate,
      enableTaxRefund,
      isNewSeller,
      commissionFeeRate,
      enableFSS,
      fssRate,
      enableCCB,
      ccbRate,
      enableMDV,
      mdvRate,
      shippingZone,
    };
    localStorage.setItem('shopeeCalcSettings_v5', JSON.stringify(settings));
    alert('設定を保存しました');
    setShowSettings(false);
  };

  // --- Calculations ---

  const qty = enableMultiItem ? parseInt(quantity) || 1 : 1;
  
  // Total weight for all items
  const totalWeight = (parseFloat(weight) || 0) * qty;

  const shippingData = React.useMemo(() => {
    if (!totalWeight) return { actualFee: 0, esfAmount: 0 };
    return getShippingData(totalWeight, shippingZone);
  }, [totalWeight, shippingZone]);

  const actualShippingFee = shippingData.actualFee;
  const esfAmount = shippingData.esfAmount;
  const sellerPaidShipping = Math.max(0, actualShippingFee - esfAmount);

  // Total selling price (for all items)
  const totalSellingPrice = (parseFloat(sellingPrice) || 0) * qty;
  
  const transactionFee = totalSellingPrice * (transactionFeeRate / 100);
  
  const appliedCommissionRate = isNewSeller ? 0 : commissionFeeRate;
  const commissionFee = totalSellingPrice * (appliedCommissionRate / 100);

  let serviceFeeTotalRate = 0;
  if (enableFSS) serviceFeeTotalRate += parseFloat(fssRate);
  if (enableCCB) serviceFeeTotalRate += parseFloat(ccbRate);
  if (enableMDV) serviceFeeTotalRate += parseFloat(mdvRate);
  
  const serviceFee = totalSellingPrice * (serviceFeeTotalRate / 100);
  
  const totalShopeeFees = transactionFee + commissionFee + serviceFee;

  const netIncomePHP = totalSellingPrice - totalShopeeFees - sellerPaidShipping;
  const netIncomeJPY = netIncomePHP * exchangeRate * (1 - payoneerFeeRate / 100);

  // --- Tax Refund Calculations ---
  const unitCost = parseFloat(costPrice) || 0;
  const unitDomestic = parseFloat(domesticShipping) || 0;
  
  // Total cost for all items
  const totalCost = unitCost * qty;
  const totalDomestic = unitDomestic * qty;
  
  const taxRate = parseFloat(consumptionTaxRate) / 100;
  const costExcludingTax = totalCost / (1 + taxRate);
  const domesticExcludingTax = totalDomestic / (1 + taxRate);
  
  const taxOnCost = totalCost - costExcludingTax;
  const taxOnDomestic = totalDomestic - domesticExcludingTax;
  const totalTaxPaid = taxOnCost + taxOnDomestic;
  
  const taxRefund = enableTaxRefund ? totalTaxPaid : 0;
  
  const totalCostJPY = totalCost + totalDomestic;
  const netCostJPY = totalCostJPY - taxRefund;
  
  const profitBeforeTaxRefund = netIncomeJPY - totalCostJPY;
  const profitAfterTaxRefund = netIncomeJPY - netCostJPY;
  
  const profit = enableTaxRefund ? profitAfterTaxRefund : profitBeforeTaxRefund;
  
  // Per-item metrics
  const profitPerItem = profit / qty;
  const netIncomePerItemJPY = netIncomeJPY / qty;
  const costPerItemJPY = netCostJPY / qty;
  
  const profitMargin = totalSellingPrice > 0 ? (profit / (totalSellingPrice * exchangeRate)) * 100 : 0;
  const roi = netCostJPY > 0 ? (profit / netCostJPY) * 100 : 0;

  const formatNum = (num) => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(num);
  const formatPHP = (num) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);

  const zoneInfo = {
    A: 'Metro Manila / Laguna / Cavite / Bulacan / Rizal',
    B: 'South Luzon (その他) / North Luzon (その他)',
    C: 'Visayas',
    D: 'Mindanao'
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen p-4 font-sans text-gray-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-2 rounded-lg text-white">
            <Calculator size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Shopee PH 利益計算</h1>
            <div className="flex gap-1 flex-wrap">
              {isNewSeller && <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">新規セラー特典</span>}
              {enableTaxRefund && <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-full">消費税還付</span>}
              {enableMultiItem && qty > 1 && <span className="text-xs text-purple-600 font-bold bg-purple-100 px-2 py-0.5 rounded-full">複数購入 ×{qty}</span>}
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Multi-item Toggle */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-purple-600" />
            <div>
              <div className="font-bold text-sm text-gray-800">複数購入シミュレーション</div>
              <div className="text-xs text-gray-500">まとめ買いの利益率を確認</div>
            </div>
          </div>
          <button 
            onClick={() => setEnableMultiItem(!enableMultiItem)}
            className={`w-12 h-6 rounded-full transition-colors relative ${enableMultiItem ? 'bg-purple-500' : 'bg-gray-300'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${enableMultiItem ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>
        
        {enableMultiItem && (
          <div className="mt-3 pt-3 border-t">
            <label className="block text-xs font-bold text-gray-700 mb-1">購入個数</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="例: 3"
            />
            <div className="text-xs text-gray-500 mt-1">
              合計重量: {totalWeight}g → 切上: {Math.ceil(totalWeight / 50) * 50}g
            </div>
          </div>
        )}
      </div>

      {/* Main Inputs */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            ① 販売価格 (PHP) {enableMultiItem && <span className="text-purple-600">/ 1個あたり</span>}
          </label>
          <div className="relative">
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="例: 500"
              className="w-full p-3 pl-4 pr-12 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">₱</span>
          </div>
          {enableMultiItem && qty > 1 && (
            <div className="text-xs text-purple-600 font-bold mt-1">
              合計: {formatPHP(totalSellingPrice)}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            ② 仕入れ原価 (JPY) {enableMultiItem && <span className="text-purple-600">/ 1個あたり</span>}
            <span className="text-xs text-gray-500 font-normal ml-1">※税込価格</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="例: 800"
              className="w-full p-3 pl-4 pr-12 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">円</span>
          </div>
          {enableMultiItem && qty > 1 && (
            <div className="text-xs text-purple-600 font-bold mt-1">
              合計: ¥{formatNum(totalCost)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              ③ 重量 (g) {enableMultiItem && <span className="text-purple-600 text-[10px]">/ 1個</span>}
            </label>
            <div className="relative">
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="例: 200"
                className="w-full p-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <span className="absolute right-3 top-3.5 text-gray-400 text-sm">g</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 text-xs">
              国内送料・梱包 (円) {enableMultiItem && <span className="text-purple-600">/ 1個</span>}
              <span className="text-gray-500 font-normal ml-1">※税込</span>
            </label>
            <input
              type="number"
              value={domesticShipping}
              onChange={(e) => setDomesticShipping(e.target.value)}
              placeholder="0"
              className="w-full p-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>

        {/* Zone Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">④ 配送先ゾーン</label>
          <div className="grid grid-cols-2 gap-2">
            {['A', 'B', 'C', 'D'].map((zone) => (
              <button
                key={zone}
                onClick={() => setShippingZone(zone)}
                className={`p-2 rounded-lg border-2 transition ${
                  shippingZone === zone
                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Zone {zone}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
            {zoneInfo[shippingZone]}
          </div>
        </div>
      </div>

      {/* Shipping Info Card */}
      {weight && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-bold text-purple-900 mb-2">
            送料詳細 (Zone {shippingZone}) {enableMultiItem && qty > 1 && <span className="text-purple-600">× {qty}個分</span>}
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-purple-700">合計重量:</span>
              <span className="font-bold text-purple-900">{totalWeight}g → {Math.ceil(totalWeight / 50) * 50}g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-700">実送料 (50g刻み):</span>
              <span className="font-bold text-purple-900">{formatPHP(actualShippingFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-700">ESF (バイヤー負担):</span>
              <span className="font-bold text-purple-900">-{formatPHP(esfAmount)}</span>
            </div>
            <div className="border-t border-purple-200 pt-1 mt-1 flex justify-between">
              <span className="text-purple-700 font-bold">セラー負担送料:</span>
              <span className="font-bold text-purple-900 text-sm">{formatPHP(sellerPaidShipping)}</span>
            </div>
            {enableMultiItem && qty > 1 && (
              <div className="bg-purple-100 p-2 rounded mt-2">
                <div className="flex justify-between text-purple-800">
                  <span className="font-bold">1個あたり送料:</span>
                  <span className="font-bold">{formatPHP(sellerPaidShipping / qty)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tax Refund Info Card */}
      {enableTaxRefund && (totalCost > 0 || totalDomestic > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <TrendingUp size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-blue-900 mb-2">
                消費税還付シミュレーション {enableMultiItem && qty > 1 && <span className="text-blue-600">× {qty}個分</span>}
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-blue-700">仕入れ消費税:</span>
                  <span className="font-bold text-blue-900">¥{formatNum(taxOnCost)}</span>
                </div>
                {totalDomestic > 0 && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">国内送料消費税:</span>
                    <span className="font-bold text-blue-900">¥{formatNum(taxOnDomestic)}</span>
                  </div>
                )}
                <div className="border-t border-blue-200 pt-1 mt-1 flex justify-between">
                  <span className="text-blue-700 font-bold">還付金合計:</span>
                  <span className="font-bold text-blue-900 text-sm">+¥{formatNum(taxRefund)}</span>
                </div>
                {enableMultiItem && qty > 1 && (
                  <div className="bg-blue-100 p-2 rounded mt-2">
                    <div className="flex justify-between text-blue-800">
                      <span className="font-bold">1個あたり還付:</span>
                      <span className="font-bold">+¥{formatNum(taxRefund / qty)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Card */}
      <div className={`rounded-2xl p-6 shadow-lg mb-6 transition-all duration-300 ${
        profit > 0 ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' : 
        profit === 0 && !sellingPrice ? 'bg-gray-200 text-gray-400' : 'bg-gray-800 text-gray-200'
      }`}>
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-sm font-medium opacity-90">
            {enableTaxRefund ? '推定粗利益 (還付込み)' : '推定粗利益 (Profit)'}
            {enableMultiItem && qty > 1 && <span className="ml-1">× {qty}個分</span>}
          </h2>
          {profit < 0 && <span className="bg-red-900 text-white text-xs px-2 py-1 rounded font-bold">赤字注意</span>}
        </div>
        
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-4xl font-bold tracking-tight">{formatNum(profit)}</span>
          <span className="text-xl font-medium">円</span>
        </div>

        {enableMultiItem && qty > 1 && (
          <div className="bg-white/20 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs opacity-90">1個あたり利益</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{formatNum(profitPerItem)}</span>
                <span className="text-sm">円</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
          <div>
            <p className="text-xs opacity-75 mb-1">利益率 (Margin)</p>
            <p className="text-lg font-bold">{profitMargin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs opacity-75 mb-1">投資利益率 (ROI)</p>
            <p className="text-lg font-bold">{roi.toFixed(1)}%</p>
          </div>
        </div>
        
        {enableTaxRefund && taxRefund > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="flex justify-between text-xs">
              <span className="opacity-75">還付金額:</span>
              <span className="font-bold">+¥{formatNum(taxRefund)}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="opacity-75">還付なしの場合:</span>
              <span className="font-bold">¥{formatNum(profitBeforeTaxRefund)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {sellingPrice && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <div className="p-4 text-sm space-y-3">
            {enableMultiItem && qty > 1 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                <div className="text-xs font-bold text-purple-900 mb-2">複数購入のメリット</div>
                <div className="space-y-1 text-xs text-purple-800">
                  <div className="flex justify-between">
                    <span>総売上:</span>
                    <span className="font-bold">{formatPHP(totalSellingPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>総コスト:</span>
                    <span className="font-bold">¥{formatNum(netCostJPY)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>送料 (1個あたり):</span>
                    <span className="font-bold">{formatPHP(sellerPaidShipping / qty)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500">手数料計 ({(transactionFeeRate + appliedCommissionRate + serviceFeeTotalRate).toFixed(2)}%)</span>
              <span className="text-red-500 font-medium">-{formatPHP(totalShopeeFees)}</span>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-2">
              {isNewSeller && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">新規(0%)</span>}
              {!isNewSeller && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">通常({commissionFeeRate}%)</span>}
              {enableFSS && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">FSS({fssRate}%)</span>}
              {enableCCB && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">CCB({ccbRate}%)</span>}
              {enableMDV && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">MDV({mdvRate}%)</span>}
            </div>

            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-gray-500">セラー負担送料</span>
                <span className="text-xs text-gray-400">
                  (実送料 {formatPHP(actualShippingFee)} - ESF {formatPHP(esfAmount)})
                </span>
              </div>
              <span className="text-red-500 font-medium">-{formatPHP(sellerPaidShipping)}</span>
            </div>

            <div className="border-t border-dashed border-gray-200 my-2"></div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600">日本円換算受取</span>
              <span className="font-bold text-gray-800">¥{formatNum(netIncomeJPY)}</span>
            </div>
            
            {enableTaxRefund && taxRefund > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">総コスト（税込）</span>
                  <span className="text-gray-800">¥{formatNum(totalCostJPY)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-600 font-medium">消費税還付金</span>
                  <span className="text-blue-600 font-bold">+¥{formatNum(taxRefund)}</span>
                </div>
                <div className="flex justify-between items-center bg-blue-50 -mx-4 px-4 py-2">
                  <span className="text-gray-700 font-bold">実質コスト（還付後）</span>
                  <span className="text-gray-900 font-bold">¥{formatNum(netCostJPY)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <h3 className="font-bold text-lg">設定 (Settings)</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-500">✕</button>
            </div>
            
            <div className="p-5 space-y-6">
              
              {/* Tax Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                  消費税設定
                </h4>
                
                <div className="flex items-center justify-between p-3 border rounded-xl bg-blue-50">
                  <div>
                    <div className="font-medium text-sm">消費税還付を計算に含める</div>
                    <div className="text-xs text-gray-500">輸出免税による仕入税額控除</div>
                  </div>
                  <button 
                    onClick={() => setEnableTaxRefund(!enableTaxRefund)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${enableTaxRefund ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${enableTaxRefund ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                
                <div className="p-3 border rounded-xl">
                  <label className="block text-xs text-gray-500 mb-1">消費税率 (%)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      step="0.1"
                      value={consumptionTaxRate} 
                      onChange={(e) => setConsumptionTaxRate(e.target.value)} 
                      className="w-full p-2 border rounded" 
                    />
                    <span className="text-sm">%</span>
                  </div>
                </div>
              </div>
              
              {/* Account Status */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  アカウント状態
                </h4>
                
                <div className="flex items-center justify-between p-3 border rounded-xl bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">新規セラー特典 (90日以内)</div>
                    <div className="text-xs text-gray-500">Commission Feeが0%になります</div>
                  </div>
                  <button 
                    onClick={() => setIsNewSeller(!isNewSeller)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isNewSeller ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isNewSeller ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              {/* Marketing Programs */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  参加プログラム & 手数料率
                </h4>
                
                <div className={`p-3 border rounded-xl ${isNewSeller ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="block text-xs text-gray-500 mb-1">通常販売手数料 (Commission)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={commissionFeeRate} onChange={(e) => setCommissionFeeRate(e.target.value)} className="w-full p-2 border rounded" />
                    <span className="text-sm">%</span>
                  </div>
                </div>

                <div className="p-3 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">FSS (Free Shipping)</span>
                    <input type="checkbox" checked={enableFSS} onChange={(e) => setEnableFSS(e.target.checked)} className="w-5 h-5 text-orange-500" />
                  </div>
                  {enableFSS && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={fssRate} onChange={(e) => setFssRate(e.target.value)} className="w-full p-2 border rounded bg-blue-50" />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>

                <div className="p-3 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CCB (Coins Cashback)</span>
                    <input type="checkbox" checked={enableCCB} onChange={(e) => setEnableCCB(e.target.checked)} className="w-5 h-5 text-orange-500" />
                  </div>
                  {enableCCB && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={ccbRate} onChange={(e) => setCcbRate(e.target.value)} className="w-full p-2 border rounded bg-yellow-50" />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>

                <div className="p-3 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">MDV (Mega Discount)</span>
                    <input type="checkbox" checked={enableMDV} onChange={(e) => setEnableMDV(e.target.checked)} className="w-5 h-5 text-orange-500" />
                  </div>
                  {enableMDV && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={mdvRate} onChange={(e) => setMdvRate(e.target.value)} className="w-full p-2 border rounded bg-purple-50" />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Base Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  基本設定
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">為替 (PHP/JPY)</label>
                    <input type="number" step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">決済手数料 (%)</label>
                    <input type="number" step="0.01" value={transactionFeeRate} onChange={(e) => setTransactionFeeRate(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Payoneer手数料 (%)</label>
                    <input type="number" step="0.01" value={payoneerFeeRate} onChange={(e) => setPayoneerFeeRate(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                </div>
              </div>

              <button 
                onClick={saveSettings}
                className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-orange-700 transition flex items-center justify-center gap-2"
              >
                <Save size={18} />
                設定を保存する
              </button>
              
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-gray-400 mt-8">
        <p>※送料や手数料は概算です。</p>
        <p className="mt-1">※消費税還付は輸出免税制度に基づく試算です。</p>
        <p className="mt-1">※送料は50g刻みで自動切り上げされます (SLS送料テーブル準拠)</p>
      </div>

    </div>
  );
};

export default ShopeeProfitCalculator;
