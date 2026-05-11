import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
let client

export async function identifyDish(base64Image) {
  if (base64Image === 'mock-image' || !process.env.ANTHROPIC_API_KEY || process.env.MOCK_AI === 'true') {
    return mockIdentifyDish()
  }

  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }
        },
        {
          type: 'text',
          text: `Identify this dish. Respond ONLY with valid JSON — no markdown, no extra text:
{"dish":"exact dish name in English","cuisine":"cuisine type","confidence":0.0}`
        }
      ]
    }]
  })

  const text = response.content[0].text.trim()
  return JSON.parse(text)
}

async function mockIdentifyDish() {
  await new Promise(resolve => setTimeout(resolve, 450))
  return {
    dish: 'Chicken Biryani',
    cuisine: 'Mughlai',
    confidence: 0.96
  }
}
