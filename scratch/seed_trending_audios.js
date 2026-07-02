const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const trendingSongs = [
  {
    title: "Big Dawgs",
    artist: "Hanumankind & Kalmi",
    instagramAudioId: "4729057193740285",
    usedCount: "250k+ Reels",
    category: "HIP-HOP, PUNCHY",
    trendScore: 100,
    region: "IN"
  },
  {
    title: "Millionaire",
    artist: "Yo Yo Honey Singh",
    instagramAudioId: "8594038592048593",
    usedCount: "1.2M+ Reels",
    category: "UPBEAT, DANCE",
    trendScore: 98,
    region: "IN"
  },
  {
    title: "Tauba Tauba",
    artist: "Karan Aujla & Sachet Tandon",
    instagramAudioId: "9302850284058104",
    usedCount: "850k+ Reels",
    category: "PUNCHY, UPBEAT",
    trendScore: 95,
    region: "IN"
  },
  {
    title: "Husn",
    artist: "Anuv Jain",
    instagramAudioId: "3948502849502850",
    usedCount: "1.1M+ Reels",
    category: "LOFI, ACOUSTIC",
    trendScore: 90,
    region: "IN"
  },
  {
    title: "Starboy",
    artist: "The Weeknd",
    instagramAudioId: "1938590284950284",
    usedCount: "2M+ Reels",
    category: "UPBEAT, POP",
    trendScore: 92,
    region: "GLOBAL"
  },
  {
    title: "Birds of a Feather",
    artist: "Billie Eilish",
    instagramAudioId: "4930582049582048",
    usedCount: "1.4M+ Reels",
    category: "LOFI, AESTHETIC",
    trendScore: 89,
    region: "GLOBAL"
  },
  {
    title: "Taras",
    artist: "Vishal Mishra & Rashmeet Kaur",
    instagramAudioId: "2940581048592048",
    usedCount: "400k+ Reels",
    category: "DRAMATIC, DANCE",
    trendScore: 87,
    region: "IN"
  },
  {
    title: "Soulmate",
    artist: "Badshah & Arijit Singh",
    instagramAudioId: "8593028592049582",
    usedCount: "500k+ Reels",
    category: "MELODIC, ROMANTIC",
    trendScore: 85,
    region: "IN"
  },
  {
    title: "Softly",
    artist: "Karan Aujla",
    instagramAudioId: "1938592048502859",
    usedCount: "600k+ Reels",
    category: "UPBEAT, DANCE",
    trendScore: 84,
    region: "IN"
  },
  {
    title: "Espresso",
    artist: "Sabrina Carpenter",
    instagramAudioId: "3948502850281948",
    usedCount: "800k+ Reels",
    category: "UPBEAT, POP",
    trendScore: 88,
    region: "GLOBAL"
  },
  {
    title: "Guli Mata",
    artist: "Saad Lamjarred & Shreya Ghoshal",
    instagramAudioId: "9384950285920485",
    usedCount: "1.5M+ Reels",
    category: "CINEMATIC, DRAMATIC",
    trendScore: 83,
    region: "IN"
  },
  {
    title: "Aayi Nai",
    artist: "Sachin-Jigar & Pawan Singh",
    instagramAudioId: "7294850184058204",
    usedCount: "900k+ Reels",
    category: "UPBEAT, DANCE",
    trendScore: 91,
    region: "IN"
  },
  {
    title: "Tu Hai Kahan",
    artist: "AUR",
    instagramAudioId: "4938592048502849",
    usedCount: "750k+ Reels",
    category: "SOULFUL, MELODIC",
    trendScore: 82,
    region: "IN"
  }
];

async function main() {
  console.log('Seeding trending audios...');
  
  // Clear existing trending audios first to avoid duplicates
  await prisma.trendingAudio.deleteMany({});
  console.log('Cleared existing trending audios.');
  
  for (const song of trendingSongs) {
    await prisma.trendingAudio.create({
      data: song
    });
  }
  
  console.log(`Successfully seeded ${trendingSongs.length} trending audios.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
