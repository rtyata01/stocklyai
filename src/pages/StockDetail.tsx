import { useNavigate, useParams } from "react-router-dom";
import { useStockDetail } from "@/hooks/useStockDetail";
import { usePriceEvaluations } from "@/hooks/usePriceEvaluations";
import { useStockData } from "@/hooks/useStockData";
import { formatCurrency } from "@/data/stocks";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const sliceEarnings = <T extends { isEstimate: boolean }>(arr: T[] | undefined): T[] => {
  if (!arr || arr.length === 0) return [];
  const historical = arr.filter(e => !e.isEstimate);
  const estimates = arr.filter(e => e.isEstimate);
  // last 3 past + current (first estimate) + next 3 estimates = 7
  return [...historical.slice(-3), ...estimates.slice(0, 4)];
};

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

  const chartGridColor = "hsl(var(--border))";
  const chartAxisColor = "hsl(var(--muted-foreground))";
  const chartTooltipBg = "hsl(var(--popover))";
  const chartTooltipBorder = "hsl(var(--border))";
  const chartTooltipText = "hsl(var(--popover-foreground))";
  const chartCardClassName = "border border-border rounded-sm p-4 bg-card";

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
                    { label: "Current Price", value: formatCurrency(quote?.price ?? detail.currentPrice) },
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

              {/* Catalysts */}
              {detail.catalysts && detail.catalysts.length > 0 && (
                <section>
                  <h2 className="font-serif text-base text-foreground mb-3 flex items-center gap-3">
                    Upcoming Catalysts <span className="flex-1 h-[1px] bg-border" />
                  </h2>
                  <div className="grid gap-2">
                    {detail.catalysts.map((c, i) => (
                      <div key={i} className="border border-border rounded-sm p-3 bg-secondary/20 flex items-start gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          c.impact === 'bullish' ? 'bg-pine' : c.impact === 'bearish' ? 'bg-destructive' : 'bg-muted-foreground'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-foreground">{c.event}</span>
                            {c.date && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                {c.date}
                              </span>
                            )}
                            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              c.impact === 'bullish' ? 'text-pine bg-pine/10' : c.impact === 'bearish' ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-secondary'
                            }`}>
                              {c.impact}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{c.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Earnings Charts */}
              <section>
                <h2 className="font-serif text-base text-foreground mb-3 flex items-center gap-3">
                  Earnings <span className="flex-1 h-[1px] bg-border" />
                </h2>
                <Tabs defaultValue="quarterly">
                  <TabsList className="mb-4 border border-border bg-secondary/30">
                    <TabsTrigger value="quarterly" className="text-xs font-mono">Quarterly</TabsTrigger>
                    <TabsTrigger value="yearly" className="text-xs font-mono">Yearly</TabsTrigger>
                  </TabsList>

                  <TabsContent value="quarterly">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={chartCardClassName}>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">EPS by Quarter</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.quarterlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <YAxis tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <Tooltip
                              contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 4, fontSize: 12 }}
                              labelStyle={{ color: chartTooltipText }}
                              itemStyle={{ color: chartTooltipText }}
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
                      <div className={chartCardClassName}>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">Revenue by Quarter ($M)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.quarterlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <YAxis tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <Tooltip
                              contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 4, fontSize: 12 }}
                              labelStyle={{ color: chartTooltipText }}
                              itemStyle={{ color: chartTooltipText }}
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
                      <div className={chartCardClassName}>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">EPS by Year</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.yearlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <YAxis tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <Tooltip
                              contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 4, fontSize: 12 }}
                              labelStyle={{ color: chartTooltipText }}
                              itemStyle={{ color: chartTooltipText }}
                            />
                            <Bar dataKey="eps" name="EPS">
                              {detail.yearlyEarnings.map((entry, i) => (
                                <Cell key={i} fill={entry.isEstimate ? 'hsl(33 30% 56% / 0.5)' : 'hsl(33 30% 56%)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={chartCardClassName}>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">Revenue by Year ($M)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={detail.yearlyEarnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <YAxis tick={{ fontSize: 10, fill: chartAxisColor }} />
                            <Tooltip
                              contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 4, fontSize: 12 }}
                              labelStyle={{ color: chartTooltipText }}
                              itemStyle={{ color: chartTooltipText }}
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
              {detail.investmentSimulation && detail.investmentSimulation.periodReturns?.length > 0 && (() => {
                const currentPriceForSimulation = detail.currentPrice > 0 ? detail.currentPrice : (quote?.price ?? 0);
                const recomputed = detail.investmentSimulation.periodReturns.map(p => {
                  const startPrice = p.startPrice;
                  const endValue = startPrice > 0 && currentPriceForSimulation > 0
                    ? (1000 / startPrice) * currentPriceForSimulation
                    : p.endValue;
                  const gain = endValue - 1000;
                  const returnPct = (gain / 1000) * 100;
                  return { ...p, endValue, returnPct, gain };
                });
                return (
                <section>
                  <h2 className="font-serif text-base text-foreground mb-3 flex items-center gap-3">
                    $1,000 Investment Returns <span className="flex-1 h-[1px] bg-border" />
                  </h2>
                  <div className="border border-border rounded-sm p-4">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">
                      Value of $1,000 invested at the start of each period (current price: {formatCurrency(currentPriceForSimulation)})
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                      {recomputed.map(p => (
                        <div key={p.period} className="border border-border rounded-sm p-2 bg-secondary/20">
                          <div className="text-[10px] font-mono text-muted-foreground uppercase">{p.label}</div>
                          <div className="font-mono text-sm text-foreground mt-0.5">{formatCurrency(p.endValue)}</div>
                          <div className={`font-mono text-[11px] ${p.returnPct >= 0 ? "text-pine" : "text-destructive"}`}>
                            {p.returnPct >= 0 ? "+" : ""}{p.returnPct.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(180, recomputed.length * 36)}>
                      <BarChart
                        data={recomputed}
                        layout="vertical"
                        margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
                        barCategoryGap="28%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: chartAxisColor }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{ fontSize: 10, fill: chartAxisColor }}
                          width={70}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted) / 0.18)' }}
                          contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 4, fontSize: 12 }}
                          labelStyle={{ color: chartTooltipText }}
                          itemStyle={{ color: chartTooltipText }}
                          formatter={(value: number, _n, item: any) => {
                            const p = item.payload;
                            const sign = p.gain >= 0 ? "+" : "−";
                            return [
                              `${value >= 0 ? "+" : ""}${value.toFixed(2)}%  •  ${formatCurrency(p.endValue)} (${sign}${formatCurrency(Math.abs(p.gain))})`,
                              'Return',
                            ];
                          }}
                        />
                        <ReferenceLine x={0} stroke={chartAxisColor} />
                        <Bar dataKey="returnPct" name="Return %" barSize={16} radius={[2, 2, 2, 2]}>
                          {recomputed.map((entry, i) => (
                            <Cell key={i} fill={entry.returnPct >= 0 ? 'hsl(134 17% 31%)' : 'hsl(0 65% 45%)'} />
                          ))}
                          <LabelList
                            dataKey="returnPct"
                            position="right"
                            formatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}
                            style={{ fill: chartTooltipText, fontSize: 10, fontFamily: 'monospace' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                );
              })()}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default StockDetail;
