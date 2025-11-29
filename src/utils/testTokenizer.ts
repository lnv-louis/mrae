/**
 * Test file for BPE Tokenizer
 *
 * This demonstrates usage of the new tokenizerService and validates
 * proper tokenization with padding, special tokens, and edge cases.
 */

import tokenizerService from '../services/tokenizerService';
import onnxService from '../services/onnxService';

/**
 * Test basic tokenization
 */
export async function testBasicTokenization() {
  console.log('\n=== Testing Basic Tokenization ===');

  // Initialize tokenizer
  const initialized = await tokenizerService.initialize();
  if (!initialized) {
    console.error('❌ Tokenizer initialization failed');
    return;
  }

  // Test cases
  const testCases = [
    'a cat sitting on a couch',
    'mountain landscape with snow',
    'sunset at the beach',
    'city skyline at night',
    'person walking in the rain',
  ];

  console.log('\nTokenizing test cases:');
  for (const text of testCases) {
    const result = tokenizerService.tokenize(text, 64, true);
    const actualTokens = result.attention_mask.filter(m => m === 1).length;

    console.log(`\nText: "${text}"`);
    console.log(`  Token count: ${actualTokens}`);
    console.log(`  Input IDs (first 10): [${result.input_ids.slice(0, 10).join(', ')}...]`);
    console.log(`  Attention mask (first 10): [${result.attention_mask.slice(0, 10).join(', ')}...]`);
    console.log(`  Total length: ${result.input_ids.length} (padded to 64)`);
  }

  // Get tokenizer status
  const status = tokenizerService.getStatus();
  console.log('\nTokenizer Status:', status);
}

/**
 * Test edge cases
 */
export async function testEdgeCases() {
  console.log('\n=== Testing Edge Cases ===');

  const edgeCases = [
    { name: 'Empty string', text: '' },
    { name: 'Single word', text: 'cat' },
    { name: 'Very long text', text: 'the quick brown fox jumps over the lazy dog ' + 'and runs through the forest '.repeat(10) },
    { name: 'Special characters', text: 'hello@world! #testing $special %chars' },
    { name: 'Numbers', text: '123 456 789 numbers test' },
    { name: 'Mixed case', text: 'MiXeD CaSe TeSt With CAPITALS' },
    { name: 'Unicode', text: 'café résumé naïve 你好 🐱' },
    { name: 'Multiple spaces', text: 'too    many     spaces' },
  ];

  await tokenizerService.initialize();

  for (const testCase of edgeCases) {
    const result = tokenizerService.tokenize(testCase.text, 64, true);
    const actualTokens = result.attention_mask.filter(m => m === 1).length;

    console.log(`\n${testCase.name}:`);
    console.log(`  Text: "${testCase.text.substring(0, 50)}${testCase.text.length > 50 ? '...' : ''}"`);
    console.log(`  Tokens: ${actualTokens}`);
    console.log(`  First token: ${result.input_ids[0]}`);
    console.log(`  Last real token: ${result.input_ids[actualTokens - 1]}`);
  }
}

/**
 * Test special tokens
 */
export async function testSpecialTokens() {
  console.log('\n=== Testing Special Tokens ===');

  await tokenizerService.initialize();

  const text = 'test sentence';
  const result = tokenizerService.tokenize(text, 64, true);

  console.log('\nSpecial Token Analysis:');
  console.log(`  PAD token (0) count: ${result.input_ids.filter(id => id === 0).length}`);
  console.log(`  EOS token (1) present: ${result.input_ids.includes(1) ? 'Yes' : 'No'}`);
  console.log(`  BOS token (2) present: ${result.input_ids.includes(2) ? 'Yes' : 'No'}`);
  console.log(`  UNK token (3) count: ${result.input_ids.filter(id => id === 3).length}`);

  // Find EOS token position
  const eosPosition = result.input_ids.indexOf(1);
  if (eosPosition !== -1) {
    console.log(`  EOS token position: ${eosPosition}`);
    console.log(`  Tokens before EOS: ${eosPosition}`);
    console.log(`  Padding tokens: ${64 - eosPosition - 1}`);
  }
}

/**
 * Test batch tokenization
 */
export async function testBatchTokenization() {
  console.log('\n=== Testing Batch Tokenization ===');

  await tokenizerService.initialize();

  const texts = [
    'cat on couch',
    'dog in park',
    'bird in tree',
    'fish in water',
  ];

  console.log(`\nBatch tokenizing ${texts.length} texts...`);
  const startTime = Date.now();
  const results = tokenizerService.batchTokenize(texts, 64, true);
  const endTime = Date.now();

  console.log(`  Completed in ${endTime - startTime}ms`);
  console.log(`  Input IDs shape: [${results.input_ids.length}, ${results.input_ids[0]?.length}]`);
  console.log(`  Attention mask shape: [${results.attention_mask.length}, ${results.attention_mask[0]?.length}]`);

  for (let i = 0; i < texts.length; i++) {
    const actualTokens = results.attention_mask[i].filter(m => m === 1).length;
    console.log(`  Text ${i + 1}: "${texts[i]}" -> ${actualTokens} tokens`);
  }
}

/**
 * Test integration with ONNX service
 */
export async function testOnnxIntegration() {
  console.log('\n=== Testing ONNX Service Integration ===');

  // Initialize ONNX service (which will initialize tokenizer)
  const initialized = await onnxService.initialize();

  console.log('\nONNX Service Status:');
  const status = onnxService.getStatus();
  console.log('  Available:', status.available);
  console.log('  Model:', status.model);
  console.log('  Tokenizer:', status.tokenizer);
  console.log('  Max Length:', status.maxLength);
  console.log('  Tokenizer Details:', status.tokenizerStatus);

  if (initialized) {
    // Test embedding generation
    const testText = 'a beautiful sunset over mountains';
    console.log(`\nGenerating embedding for: "${testText}"`);

    try {
      const embedding = await onnxService.embedText(testText);
      if (embedding) {
        console.log(`  Embedding dimension: ${embedding.length}D`);
        console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log(`  Norm (L2): ${Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)).toFixed(4)}`);
      } else {
        console.log('  Failed to generate embedding (using fallback)');
      }
    } catch (error: any) {
      console.error('  Error:', error?.message || error);
    }
  } else {
    console.log('\nONNX service not available (native module not loaded)');
    console.log('This is expected in development or if ONNX Runtime is not linked');
  }
}

/**
 * Test performance with various text lengths
 */
export async function testPerformance() {
  console.log('\n=== Testing Tokenization Performance ===');

  await tokenizerService.initialize();

  const testSizes = [
    { name: 'Short (5 words)', text: 'cat on a couch sitting' },
    { name: 'Medium (15 words)', text: 'a beautiful mountain landscape with snow covered peaks and a clear blue sky above the horizon' },
    { name: 'Long (30 words)', text: 'the quick brown fox jumps over the lazy dog and runs through the dense forest filled with tall trees and various wildlife creatures living in harmony with nature under the bright sun' },
    { name: 'Very Long (60 words)', text: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur' },
  ];

  for (const test of testSizes) {
    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      tokenizerService.tokenize(test.text, 64, true);
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;

    console.log(`\n${test.name}:`);
    console.log(`  Text length: ${test.text.length} chars, ${test.text.split(' ').length} words`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${(1000 / avgTime).toFixed(0)} tokenizations/sec`);
  }
}

/**
 * Run all tests
 */
export async function runAllTokenizerTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   BPE Tokenizer Test Suite                ║');
  console.log('║   SigLIP-2 GemmaTokenizer                  ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await testBasicTokenization();
    await testEdgeCases();
    await testSpecialTokens();
    await testBatchTokenization();
    await testPerformance();
    await testOnnxIntegration();

    console.log('\n✅ All tests completed!\n');
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error?.message || error);
  }
}

// Export individual test functions
export default {
  runAllTokenizerTests,
  testBasicTokenization,
  testEdgeCases,
  testSpecialTokens,
  testBatchTokenization,
  testPerformance,
  testOnnxIntegration,
};
