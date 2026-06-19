const passport           = require('passport');
const GoogleStrategy     = require('passport-google-oauth20').Strategy;
const TwitterStrategy    = require('passport-twitter-oauth2').Strategy;
const InstagramStrategy  = require('passport-instagram').Strategy;
const prisma             = require('./prisma');

// ─── Google ──────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID     : process.env.GOOGLE_CLIENT_ID,
      clientSecret : process.env.GOOGLE_CLIENT_SECRET,
      callbackURL  : `${process.env.BACKEND_URL || 'http://localhost:6001'}/api/auth/google/callback`,
      scope        : ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email  = profile.emails?.[0]?.value;
        const name   = profile.displayName || profile.name?.givenName;
        const avatar = profile.photos?.[0]?.value;

        // Check if user exists by googleId or email
        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId: profile.id }, ...(email ? [{ email }] : [])] },
        });

        if (user) {
          // Update googleId and verify email if they previously registered with email
          if (!user.googleId || !user.emailVerified) {
            user = await prisma.user.update({
              where: { id: user.id },
              data : { 
                googleId: profile.id, 
                avatar: avatar || user.avatar,
                emailVerified: true
              },
            });
          }
        } else {
          if (!email) return done(new Error('No email from Google'), null);
          user = await prisma.user.create({
            data: {
              email,
              name   : name || email.split('@')[0],
              googleId: profile.id,
              avatar,
              emailVerified: true,
            },
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
}

// ─── X / Twitter ─────────────────────────────────────────────────────
if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
  passport.use(new TwitterStrategy(
    {
      clientID     : process.env.TWITTER_CLIENT_ID,
      clientSecret : process.env.TWITTER_CLIENT_SECRET,
      callbackURL  : `${process.env.BACKEND_URL || 'http://localhost:6001'}/api/auth/twitter/callback`,
      scope        : ['tweet.read', 'users.read', 'offline.access'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const name   = profile.displayName || profile.username;
        const avatar = profile.photos?.[0]?.value;

        let user = await prisma.user.findUnique({ where: { twitterId: profile.id } });

        if (!user) {
          // Generate a placeholder email for Twitter users (Twitter OAuth 2.0 doesn't always give email)
          const email = `twitter_${profile.id}@oauth.reelcoach`;
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) {
            user = await prisma.user.update({
              where: { id: existing.id },
              data : { twitterId: profile.id, avatar: avatar || existing.avatar, emailVerified: true },
            });
          } else {
            user = await prisma.user.create({
              data: { email, name, twitterId: profile.id, avatar, emailVerified: true },
            });
          }
        } else if (!user.emailVerified) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true }
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
}

// ─── Instagram ────────────────────────────────────────────────────────
if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) {
  passport.use(new InstagramStrategy(
    {
      clientID     : process.env.INSTAGRAM_CLIENT_ID,
      clientSecret : process.env.INSTAGRAM_CLIENT_SECRET,
      callbackURL  : `${process.env.BACKEND_URL || 'http://localhost:6001'}/api/auth/instagram/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const name   = profile.displayName || profile.username;
        const avatar = profile.photos?.[0]?.value;
        // Instagram doesn't provide email — use a stable placeholder
        const email  = `instagram_${profile.id}@oauth.reelcoach`;

        let user = await prisma.user.findFirst({
          where: { OR: [{ email }] },
        });

        if (user) {
          // Update avatar and mark emailVerified if not already
          const updateData = {};
          if (avatar && user.avatar !== avatar) {
            updateData.avatar = avatar;
          }
          if (!user.emailVerified) {
            updateData.emailVerified = true;
          }
          if (Object.keys(updateData).length > 0) {
            user = await prisma.user.update({ where: { id: user.id }, data: updateData });
          }
        } else {
          user = await prisma.user.create({
            data: { email, name: name || 'Instagram User', avatar, emailVerified: true },
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
