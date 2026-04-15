import { useNavigate, useParams } from "react-router-dom";
import { useStockDetail } from "@/hooks/useStockDetail";
import { usePriceEvaluations } from "@/hooks/usePriceEvaluations";
import { useStockData } from "@/hooks/useStockData";
import { formatCurrency } from "@/data/stocks";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, Cell,
} from "recharts";

const StockDetail = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const { data: detail, isLoading, error } = useStockDetail(ticker);
  const { data: quotes } = useStockData();
  const { data: evaluations } = usePriceEvaluations(quotes);

  const quote = quotes?.find(q => q.ticker === ticker);
  const evalData = evaluations?.find(e => e.ticker === ticker);

  if (!ticker) return null;

  const week52Pct = detail
    ? ((detail.currentPrice - detail.week52Low) / (detail.week52High - detail.week52Low)) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border min-h-screen">
        {/* Header */}
        <header className="px-6 md:px-10 pt-6 pb-4 border-b border-border bg-gradient-to-b from-secondary/30 to-transparent">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs mb-4 -ml-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Button>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground">
                {ticker}
              </h1>
              {quote && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-mono text-lg text-foreground">{formatCurrency(quote.price)}</span>
                  <span className={`font-mono text-sm flex items-center gap-1 ${quote.change >= 0 ? "text-pine" : "text-destructive"}`}>
                    {quote.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            {evalData && (
              <div className="flex gap-4 text-right">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Buy</div>
                  <div className="font-mono text-sm text-primary">{formatCurrency(evalData.buyPrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Hold</div>
                  <div className="font-mono text-sm text-muted-foreground">{formatCurrency(evalData.holdPrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Sell</div>
                  <div className="font-mono text-sm text-destructive">{formatCurrency(evalData.salePrice)}</div>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="p-4 md:p-8 space-y-6">
          {isLoading && (
            <div className="text-center text-muted-foreground py-20 font-mono text-sm">
              Loading stock details…
            </div>
          )}
          {error && (
            <div className="text-center text-destructive py-20 font-mono text-sm">
              Failed to load details. Please try again.
            </div>
          )}

          {detail && (
            <>
              {/* Key Metrics */}
              <section>
                <h2 className="font-serif text-base text-foreground mb-3 flex items-center gap-3">
                  Key Metrics <span className="flex-1 h-[1px] bg-border" />
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "52W High", value: detail.week52High ? formatCurrency(detail.week52High) : "—" },
                    { label: "52W Low", value: detail.week52Low ? formatCurrency(detail.week52Low) : "—" },
                    { label: "P/E Ratio", value: detail.peRatio?.toFixed(2) ?? "N/A" },
                    { label: "EPS (TTM)", value: detail.eps != null ? `$${detail.eps.toFixed(2)}` : "N/A" },
                    { label: "Free Cash Flow", value: detail.freeCashFlow != null ? `$${detail.freeCashFlow.toLocaleString()}M` : "N/A" },
                    { label: "Total Revenue", value: detail.totalRevenue != null ? `$${detail.totalRevenue.toLocaleString()}M` : "N/A" },
                    { label: "Market Cap", value: detail.marketCap != null ? `$${detail.marketCap.toFixed(1)}B` : "N/A" },
                  ].map(m => (
                    <div key={m.label} className="border border-border rounded-sm p-3 bg-secondary/20">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{m.label}</div>
                      <div className="font-mono text-sm text-foreground mt-1">{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* 52 Week Range Bar */}
                {detail.week52Low > 0 && detail.week52High > 0 && (
                  <div className="mt-3 border border-border rounded-sm p-3 bg-secondary/20">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">52 Week Range</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{formatCurrency(detail.week52Low)}</span>
                      <div className="flex-1 h-2 bg-border rounded-full relative overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, week52Pct))}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{formatCurrency(detail.week52High)}</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Earnings Charts */}
              <section>
                <h2 className="font-serif text-base text-foreground mb-3 flex items-center gap-3">
                  Earnings <span className="flex-1 h-[1px] bg-border" />
                </h2>
                <Tabs defaultValue="quarterly">
                  <TabsList className="mb-4">
                    <TabsTrigger value="quarterly" className="text-xs font-mono">Quarterly</TabsTrigger>
                    <TabsTrigger value="yearly" className="text-xs font-mono">Yearly</TabsTrigger>
                  </TabsList>

                  <TabsContent value="quarterly">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="border border-border rounded-sm p-4">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">EPS by Quarter</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.quarterlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(16 10% 23%)" />
                            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(18 12% 11%)', border: '1px solid hsl(16 10% 23%)', borderRadius: 4, fontSize: 12 }}
                              labelStyle={{ color: 'hsl(35 20% 90%)' }}
                            />
                            <Bar dataKey="eps" name="EPS">
                              {detail.quarterlyEarnings.map((entry, i) => (
                                <Cell key={i} fill={entry.isEstimate ? 'hsl(33 30% 56% / 0.5)' : 'hsl(33 30% 56%)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ background: 'hsl(33 30% 56%)' }} /> Actual</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ background: 'hsl(33 30% 56% / 0.5)' }} /> Estimate</span>
                        </div>
                      </div>
                      <div className="border border-border rounded-sm p-4">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">Revenue by Quarter ($M)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.quarterlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(16 10% 23%)" />
                            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(18 12% 11%)', border: '1px solid hsl(16 10% 23%)', borderRadius: 4, fontSize: 12 }}
                            />
                            <Bar dataKey="revenue" name="Revenue ($M)">
                              {detail.quarterlyEarnings.map((entry, i) => (
                                <Cell key={i} fill={entry.isEstimate ? 'hsl(134 17% 31% / 0.5)' : 'hsl(134 17% 31%)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="yearly">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="border border-border rounded-sm p-4">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">EPS by Year</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.yearlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(16 10% 23%)" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(18 12% 11%)', border: '1px solid hsl(16 10% 23%)', borderRadius: 4, fontSize: 12 }}
                            />
                            <Bar dataKey="eps" name="EPS">
                              {detail.yearlyEarnings.map((entry, i) => (
                                <Cell key={i} fill={entry.isEstimate ? 'hsl(33 30% 56% / 0.5)' : 'hsl(33 30% 56%)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="border border-border rounded-sm p-4">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">Revenue by Year ($M)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.yearlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(16 10% 23%)" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(18 12% 11%)', border: '1px solid hsl(16 10% 23%)', borderRadius: 4, fontSize: 12 }}
                            />
                            <Bar dataKey="revenue" name="Revenue ($M)">
                              {detail.yearlyEarnings.map((entry, i) => (
                                <Cell key={i} fill={entry.isEstimate ? 'hsl(134 17% 31% / 0.5)' : 'hsl(134 17% 31%)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>


              {/* $1000 Investment Simulation */}
              {detail.investmentSimulation && (
                <section>
                  <h2 className="font-serif text-base text-foreground mb-3 flex items-center gap-3">
                    $1,000 Investment Simulation <span className="flex-1 h-[1px] bg-border" />
                  </h2>
                  <div className="border border-border rounded-sm p-4">
                    <div className="flex gap-6 mb-4">
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Initial</div>
                        <div className="font-mono text-sm text-foreground">{formatCurrency(detail.investmentSimulation.initialInvestment)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Current Value</div>
                        <div className="font-mono text-sm text-foreground">{formatCurrency(detail.investmentSimulation.currentValue)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Total Return</div>
                        <div className={`font-mono text-sm ${detail.investmentSimulation.totalReturn >= 0 ? "text-pine" : "text-destructive"}`}>
                          {detail.investmentSimulation.totalReturn >= 0 ? "+" : ""}{detail.investmentSimulation.totalReturn.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={detail.investmentSimulation.dataPoints}>
                        <defs>
                          <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(134 17% 31%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(134 17% 31%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(16 10% 23%)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(18 12% 11%)', border: '1px solid hsl(16 10% 23%)', borderRadius: 4, fontSize: 12 }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
                        />
                        <ReferenceLine y={1000} stroke="hsl(35 8% 60%)" strokeDasharray="3 3" label={{ value: '$1,000', fontSize: 10, fill: 'hsl(35 8% 60%)' }} />
                        <Area type="monotone" dataKey="value" stroke="hsl(134 17% 31%)" fill="url(#simGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default StockDetail;
