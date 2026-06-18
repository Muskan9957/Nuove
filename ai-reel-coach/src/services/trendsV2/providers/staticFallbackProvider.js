const STATIC_TRENDS = {
  'photography': [
    { title: 'iPhone vs DSLR Challenge', description: 'Comparing smartphone cameras with professional gear in 2024.', keywords: ['iphone photography', 'dslr'], category: 'photography', confidence: 'Medium' },
    { title: 'Dark Moody Portrait Editing', description: 'How to achieve the cinematic dark moody look in Lightroom.', keywords: ['lightroom', 'portrait editing'], category: 'photography', confidence: 'Medium' },
    { title: 'Film Camera Resurgence', description: 'Why Gen Z is buying up vintage point-and-shoot film cameras.', keywords: ['film camera', 'vintage', '35mm'], category: 'photography', confidence: 'Medium' }
  ],
  'filmmaking': [
    { title: 'Zero Budget Lighting Hacks', description: 'How to light a cinematic scene using only household lamps.', keywords: ['lighting', 'cinematography', 'budget'], category: 'filmmaking', confidence: 'Medium' },
    { title: 'The Perfect B-Roll Sequence', description: 'A breakdown of how to shoot dynamic B-roll for any video.', keywords: ['b-roll', 'video editing'], category: 'filmmaking', confidence: 'Medium' },
    { title: 'CapCut vs Premiere Pro', description: 'Is mobile editing finally replacing desktop software?', keywords: ['capcut', 'premiere pro', 'editing'], category: 'filmmaking', confidence: 'Medium' }
  ],
  'finance': [
    { title: 'The 50/30/20 Budgeting Rule', description: 'A simple framework to manage your monthly income effectively.', keywords: ['budgeting', 'personal finance'], category: 'finance', confidence: 'Medium' },
    { title: 'Index Funds Explained', description: 'Why boring investing beats day trading for most people.', keywords: ['investing', 'index funds', 'wealth'], category: 'finance', confidence: 'Medium' },
    { title: 'Side Hustles That Actually Work', description: 'Realistic ways to make an extra $1,000 a month in 2024.', keywords: ['side hustle', 'passive income'], category: 'finance', confidence: 'Medium' }
  ],
  'ai & technology': [
    { title: 'AI Tools That Will Save You Hours', description: 'The top AI productivity tools you should be using instead of ChatGPT.', keywords: ['ai tools', 'productivity', 'tech'], category: 'ai & technology', confidence: 'Medium' },
    { title: 'The End of Traditional Search?', description: 'How AI search engines are changing the way we find information.', keywords: ['ai search', 'google', 'tech news'], category: 'ai & technology', confidence: 'Medium' },
    { title: 'Smart Home Automation Setup', description: 'Beginner guide to building a smart home ecosystem.', keywords: ['smart home', 'automation', 'gadgets'], category: 'ai & technology', confidence: 'Medium' }
  ],
  'sports': [
    { title: 'Athlete Morning Routines', description: 'What professional athletes do in the first hour of their day.', keywords: ['sports', 'routine', 'fitness'], category: 'sports', confidence: 'Medium' },
    { title: 'The Rise of Padel', description: 'Why this racket sport is taking over the world so quickly.', keywords: ['padel', 'tennis', 'trends'], category: 'sports', confidence: 'Medium' },
    { title: 'Recovery Methods that Work', description: 'Ice baths vs saunas: what actually helps muscle recovery.', keywords: ['recovery', 'fitness', 'health'], category: 'sports', confidence: 'Medium' }
  ],
  'geopolitics': [
    { title: 'The Global Chip War', description: 'How semiconductor manufacturing is shaping modern international relations.', keywords: ['geopolitics', 'technology', 'semiconductors'], category: 'geopolitics', confidence: 'Medium' },
    { title: 'Shifting Supply Chains', description: 'Why companies are moving manufacturing out of traditional hubs.', keywords: ['supply chain', 'economics', 'global trade'], category: 'geopolitics', confidence: 'Medium' },
    { title: 'The Space Race 2.0', description: 'How private companies and new nations are competing in space.', keywords: ['space', 'exploration', 'geopolitics'], category: 'geopolitics', confidence: 'Medium' }
  ],
  'default': [
    { title: 'Morning Routine Reset', description: 'How to build a morning routine that actually sticks.', keywords: ['routine', 'productivity', 'lifestyle'], category: 'lifestyle', confidence: 'Medium' },
    { title: 'Digital Minimalism', description: 'Tips for reducing screen time and reclaiming your focus.', keywords: ['digital minimalism', 'focus', 'mental health'], category: 'lifestyle', confidence: 'Medium' },
    { title: 'The 80/20 Rule in Daily Life', description: 'Applying the Pareto principle to get more done with less effort.', keywords: ['productivity', 'pareto principle', 'life hacks'], category: 'lifestyle', confidence: 'Medium' }
  ]
};

function getStaticFallback(niche, region) {
  const nicheKey = niche.toLowerCase();
  let trends = STATIC_TRENDS[nicheKey] || STATIC_TRENDS['default'];
  
  return trends.map(t => ({
    id: 'tr_static_' + Math.random().toString(36).substr(2, 9),
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    category: t.category,
    region: region,
    niche: niche,
    confidence: 'Low',
    sources: ['static_fallback'],
    evidence: [{ source: 'system', title: 'Fallback data used due to API unavailability.' }],
    nicheRelevanceScore: 100,
    createdAt: new Date().toISOString()
  }));
}

module.exports = { getStaticFallback };
