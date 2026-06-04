const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./mhu-report-2.json', 'utf8'));

const score = data.categories.performance.score * 100;
const metrics = {
  fcp: data.audits['first-contentful-paint'].displayValue,
  lcp: data.audits['largest-contentful-paint'].displayValue,
  tbt: data.audits['total-blocking-time'].displayValue,
  cls: data.audits['cumulative-layout-shift'].displayValue,
  si: data.audits['speed-index'].displayValue
};

const opportunities = Object.values(data.audits)
  .filter(a => a.details && a.details.type === 'opportunity' && a.score < 0.9)
  .map(a => ({
    id: a.id,
    title: a.title,
    savingsMs: a.details.overallSavingsMs,
    wastedBytes: a.details.overallSavingsBytes
  }))
  .sort((a, b) => b.savingsMs - a.savingsMs);

const diagnostics = Object.values(data.audits)
  .filter(a => ['server-response-time', 'mainthread-work-breakdown', 'bootup-time', 'dom-size', 'uses-long-cache-ttl', 'unminified-javascript', 'unminified-css'].includes(a.id) && a.score < 0.9)
  .map(a => ({
    id: a.id,
    title: a.title,
    displayValue: a.displayValue
  }));

console.log('Performance Score:', score);
console.log('\nMetrics:', metrics);
console.log('\nTop Opportunities:');
console.table(opportunities);
console.log('\nDiagnostics:');
console.table(diagnostics);
