const prisma = require('../config/prisma')

// One-time (idempotent) migration: older coach chats were stored as a flat list
// of messages with no conversation grouping. This groups each user's legacy
// messages into conversations (split on >30-min gaps) so they show up in the
// new history sidebar. Runs on boot; once every message has a conversationId it
// becomes a no-op, so it's safe to leave in place.
const GAP_MS = 30 * 60 * 1000

async function backfillConversations() {
  try {
    const orphanCount = await prisma.chatMessage.count({ where: { conversationId: null } })
    if (orphanCount === 0) return

    console.log(`[backfill] grouping ${orphanCount} legacy coach messages into conversations…`)

    const users = await prisma.chatMessage.findMany({
      where   : { conversationId: null },
      distinct: ['userId'],
      select  : { userId: true },
    })

    let made = 0
    for (const { userId } of users) {
      const msgs = await prisma.chatMessage.findMany({
        where  : { userId, conversationId: null },
        orderBy: { createdAt: 'asc' },
        select : { id: true, role: true, content: true, createdAt: true },
      })
      if (msgs.length === 0) continue

      // Split into conversations on large time gaps
      const groups = []
      let cur = null, lastTime = 0
      for (const m of msgs) {
        const tms = new Date(m.createdAt).getTime()
        if (!cur || tms - lastTime > GAP_MS) {
          cur = { ids: [], firstUser: null, start: m.createdAt, end: m.createdAt }
          groups.push(cur)
        }
        cur.ids.push(m.id)
        cur.end = m.createdAt
        if (!cur.firstUser && m.role === 'user' && m.content) cur.firstUser = m.content
        lastTime = tms
      }

      for (const g of groups) {
        const src = (g.firstUser || 'Earlier chat').trim().replace(/\s+/g, ' ')
        const title = src.length > 48 ? src.slice(0, 48).trim() + '…' : (src || 'Earlier chat')
        const conv = await prisma.conversation.create({
          data: { userId, title, createdAt: g.start, updatedAt: g.end },
        })
        await prisma.chatMessage.updateMany({
          where: { id: { in: g.ids } },
          data : { conversationId: conv.id },
        })
        made++
      }
    }
    console.log(`[backfill] done — created ${made} conversations`)
  } catch (err) {
    console.error('[backfill] failed:', err.message)
  }
}

module.exports = { backfillConversations }
