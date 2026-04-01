#!/usr/bin/env node
/**
 * Creates Stripe Payment Links for all pricing tiers (monthly + annual)
 * Run: node scripts/create-stripe-links.js
 */

require('dotenv').config();
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Pricing in cents
const PRICING = {
  starter: { monthly: 2900, annual: 29000 },  // $29/mo, $290/yr (save ~17%)
  pro: { monthly: 9900, annual: 99000 },      // $99/mo, $990/yr (save ~17%)
  compliance: { monthly: 19900, annual: 199000 }, // $199/mo, $1990/yr (save ~17%)
};

async function getOrCreateProduct(name) {
  // Check if product exists
  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find(p => p.name === name);
  
  if (!product) {
    product = await stripe.products.create({
      name,
      description: `guardrail ${name} Plan`,
    });
    console.log(`Created product: ${name}`);
  }
  return product;
}

async function getOrCreatePrice(productId, amount, interval, tierName) {
  const prices = await stripe.prices.list({ product: productId, limit: 100 });
  let price = prices.data.find(p => 
    p.unit_amount === amount && 
    p.recurring?.interval === interval
  );
  
  if (!price) {
    price = await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: 'usd',
      recurring: { interval },
    });
    console.log(`Created ${interval} price for ${tierName}: $${amount/100}`);
  }
  return price;
}

async function createPaymentLinks() {
  console.log('Creating Stripe Products, Prices, and Payment Links...\n');

  const links = {};

  for (const [tier, pricing] of Object.entries(PRICING)) {
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    links[tier] = {};
    
    // Get or create product
    const product = await getOrCreateProduct(`guardrail ${tierName}`);
    
    // Monthly
    const monthlyPrice = await getOrCreatePrice(product.id, pricing.monthly, 'month', tierName);
    const monthlyLink = await stripe.paymentLinks.create({
      line_items: [{ price: monthlyPrice.id, quantity: 1 }],
      after_completion: {
        type: 'redirect',
        redirect: { url: `${process.env.FRONTEND_URL}/dashboard?welcome=true&plan=${tier}` },
      },
    });
    links[tier].monthly = monthlyLink.url;
    console.log(`✓ ${tier} monthly: ${monthlyLink.url}`);
    
    // Annual
    const annualPrice = await getOrCreatePrice(product.id, pricing.annual, 'year', tierName);
    const annualLink = await stripe.paymentLinks.create({
      line_items: [{ price: annualPrice.id, quantity: 1 }],
      after_completion: {
        type: 'redirect',
        redirect: { url: `${process.env.FRONTEND_URL}/dashboard?welcome=true&plan=${tier}` },
      },
    });
    links[tier].annual = annualLink.url;
    console.log(`✓ ${tier} annual: ${annualLink.url}`);
  }

  console.log('\n--- Copy this to your page.tsx ---\n');
  console.log('const stripeLinks: Record<string, { monthly: string; annual: string }> = {');
  for (const [tier, tierLinks] of Object.entries(links)) {
    console.log(`  ${tier}: {`);
    console.log(`    monthly: "${tierLinks.monthly}",`);
    console.log(`    annual: "${tierLinks.annual}",`);
    console.log('  },');
  }
  console.log('};');
}

createPaymentLinks().catch(console.error);
