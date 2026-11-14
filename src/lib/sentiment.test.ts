import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCompositeSentiment,
  detectSentimentDivergence,
  scoreHeadlineSentiment,
} from './sentiment';

test('scoreHeadlineSentiment classifies bullish and bearish catalysts', () => {
  const bull = scoreHeadlineSentiment(
    'Spot ETF inflows surge on institutional adoption and breakout'
  );
  assert.equal(bull.bias, 'Bullish');
  assert.ok(bull.score > 30);
  assert.equal(bull.impact, 'High');

  const bear = scoreHeadlineSentiment(
    'Exchange exploit triggers liquidations and SEC lawsuit'
  );
  assert.equal(bear.bias, 'Bearish');
  assert.ok(bear.score < -30);

  const neutral = scoreHeadlineSentiment(
    'Scheduled network conference concludes in Zurich'
  );
  assert.equal(neutral.bias, 'Neutral');
});

test('computeCompositeSentiment weights multi-source metrics correctly', () => {
  const score = computeCompositeSentiment([
    { id: 'news', score: 80 },
    { id: 'social', score: 60 },
    { id: 'derivatives', score: 70 },
    { id: 'onchain', score: 90 },
  ]);
  // 80*0.3 + 60*0.25 + 70*0.25 + 90*0.2 = 24 + 15 + 17.5 + 18 = 74.5 -> 75
  assert.equal(score, 75);
});

test('detectSentimentDivergence flags bullish and bearish divergences', () => {
  const bullDiv = detectSentimentDivergence(-3.2, 64, 5.4);
  assert.equal(bullDiv.status, 'Bullish Divergence');

  const bearDiv = detectSentimentDivergence(3.5, 38, -6.0);
  assert.equal(bearDiv.status, 'Bearish Divergence');

  const aligned = detectSentimentDivergence(2.1, 68, 4.2);
  assert.equal(aligned.status, 'Aligned');
});
