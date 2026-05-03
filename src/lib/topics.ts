// AI sub-vertical topics. Each maps a slug to:
//  - title-cased name shown to users
//  - searchTerms: lowercased substrings to look for in description + matched_keywords
//  - description: what this topic is about (for SEO)

export interface Topic {
  slug: string;
  name: string;
  searchTerms: string[];
  description: string;
}

export const TOPICS: Topic[] = [
  {
    slug: 'large-language-models',
    name: 'Large Language Models (LLM)',
    searchTerms: ['large language model', 'llm', 'gpt', 'chatgpt', 'foundation model'],
    description: 'Federal contracts involving large language models, generative text AI, and foundation models.',
  },
  {
    slug: 'generative-ai',
    name: 'Generative AI',
    searchTerms: ['generative ai', 'genai', 'gen ai', 'generative artificial'],
    description: 'Federal contracts for generative AI capabilities — text, image, code, and synthetic data generation.',
  },
  {
    slug: 'computer-vision',
    name: 'Computer Vision',
    searchTerms: ['computer vision', 'image recognition', 'object detection', 'image classification', 'video analytics'],
    description: 'Federal contracts for computer vision, image recognition, object detection, and video analytics systems.',
  },
  {
    slug: 'natural-language-processing',
    name: 'Natural Language Processing (NLP)',
    searchTerms: ['natural language processing', 'nlp', 'text analytics', 'sentiment analysis', 'speech recognition'],
    description: 'Federal contracts for natural language processing, text analytics, and speech recognition systems.',
  },
  {
    slug: 'machine-learning',
    name: 'Machine Learning',
    searchTerms: ['machine learning', ' ml ', 'supervised learning', 'unsupervised learning', 'reinforcement learning'],
    description: 'Federal machine learning contracts — model development, training, and deployment.',
  },
  {
    slug: 'deep-learning',
    name: 'Deep Learning',
    searchTerms: ['deep learning', 'neural network', 'convolutional', 'transformer', 'recurrent neural'],
    description: 'Federal deep learning contracts — neural networks, transformers, and advanced model architectures.',
  },
  {
    slug: 'predictive-analytics',
    name: 'Predictive Analytics',
    searchTerms: ['predictive analytics', 'predictive model', 'forecasting', 'predictive maintenance'],
    description: 'Federal predictive analytics contracts — forecasting, predictive maintenance, and decision support.',
  },
  {
    slug: 'mlops',
    name: 'MLOps & AI Infrastructure',
    searchTerms: ['mlops', 'ml ops', 'ai platform', 'model deployment', 'ai infrastructure'],
    description: 'Federal contracts for MLOps platforms, AI infrastructure, and model deployment systems.',
  },
  {
    slug: 'autonomous-systems',
    name: 'Autonomous Systems',
    searchTerms: ['autonomous', 'self-driving', 'unmanned', 'autonomous vehicle', 'autonomous system'],
    description: 'Federal contracts for autonomous systems, unmanned vehicles, and self-directed AI agents.',
  },
  {
    slug: 'ai-cybersecurity',
    name: 'AI for Cybersecurity',
    searchTerms: ['ai cyber', 'ai security', 'threat detection', 'anomaly detection', 'ai cybersecurity'],
    description: 'Federal contracts using AI/ML for cybersecurity, threat detection, and anomaly detection.',
  },
];

export function getTopicBySlug(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
