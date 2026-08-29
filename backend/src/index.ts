import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter';

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})


app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per window
    keyGenerator: (c) => c.req.header('cf-connecting-ip') ?? 'anonymous',
  })
)

export default {app}