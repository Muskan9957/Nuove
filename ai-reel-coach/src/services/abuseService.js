const crypto = require('crypto');
const prisma = require('../config/prisma');
const disposableDomains = require('../config/disposableDomains.json');

// Secret pepper for hashing IPs and User-Agents securely
// Fallback is provided, but in production ABUSE_SECRET_SALT should be in .env
const SALT = process.env.ABUSE_SECRET_SALT || 'fallback-abuse-salt-2026';

// ─── Cryptographic Hashes ──────────────────────────────────────────
const hashValue = (value) => {
  if (!value) return null;
  return crypto.createHmac('sha256', SALT).update(String(value)).digest('hex');
};

const hashFingerprint = (fingerprint) => {
  if (!fingerprint) return null;
  return crypto.createHmac('sha256', SALT).update(fingerprint + '_device').digest('hex');
};

// ─── Core Abuse Assessment ──────────────────────────────────────────
const assessRegistrationTrust = async ({ email, ip, userAgent, clientFingerprint }) => {
  const ipHash = hashValue(ip);
  const uaHash = hashValue(userAgent);
  const fpHash = hashFingerprint(clientFingerprint);

  const domain = email.split('@')[1]?.toLowerCase();
  const isDisposable = disposableDomains.includes(domain);

  let riskScore = 0;
  
  if (isDisposable) {
    riskScore += 100; // instant high risk
  }

  // Look for any existing DeviceUsage matching the fpHash or ip+ua combo
  let deviceHash = fpHash;
  let deviceUsage = null;

  if (deviceHash) {
    deviceUsage = await prisma.deviceUsage.findUnique({ where: { deviceHash } });
  }

  // Fallback to IP+UA heuristic if fingerprint missing or not found
  if (!deviceUsage && ipHash && uaHash) {
    const heuristicHash = hashValue(ipHash + uaHash);
    if (!deviceHash) deviceHash = heuristicHash; // use heuristic as ID if no FP provided
    
    // Check if heuristic matches an existing device
    const matchingDevice = await prisma.deviceUsage.findFirst({
      where: { lastIpHash: ipHash, lastUserAgentHash: uaHash },
      orderBy: { lastSeenAt: 'desc' }
    });
    
    if (matchingDevice) {
      deviceUsage = matchingDevice;
      deviceHash = matchingDevice.deviceHash; // merge into existing trust profile
    }
  }

  // If we still have no deviceHash, generate a random one to establish a new profile
  if (!deviceHash) {
    deviceHash = crypto.randomBytes(16).toString('hex');
  }

  // Evaluate Velocity & History
  if (deviceUsage) {
    // Has this device created an account in the last 24 hours?
    const hoursSinceLastReg = (Date.now() - new Date(deviceUsage.lastRegistrationAt).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastReg < 24) {
      riskScore += 30; // Rapid consecutive registrations
    }

    if (deviceUsage.accountCount >= 3) {
      riskScore += 20; // Multiple accounts history
    }
    
    if (deviceUsage.accountCount >= 10) {
      riskScore += 50; // Farm behavior
    }
    
    // Inherit existing risk
    riskScore += deviceUsage.riskScore;
  }

  // Determine Trust Level
  let trustLevel = 'NORMAL';
  if (riskScore >= 100) {
    trustLevel = 'RESTRICTED';
  } else if (riskScore >= 50) {
    trustLevel = 'SUSPICIOUS';
  } else if (deviceUsage && deviceUsage.accountCount === 1 && deviceUsage.riskScore === 0) {
    trustLevel = 'TRUSTED';
  }

  return {
    deviceHash,
    isDisposable,
    riskScore,
    trustLevel,
    ipHash,
    uaHash,
    existingUsage: deviceUsage
  };
};

module.exports = {
  hashValue,
  hashFingerprint,
  assessRegistrationTrust
};
