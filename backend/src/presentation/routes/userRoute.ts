import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter';

const userRouter = new Hono()

userRouter.get('/', (c) => {
  return c.text('Hello Hono!')
})


userRouter.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per window
    keyGenerator: (c) => c.req.header('cf-connecting-ip') ?? 'anonymous',
  })
)

userRouter.post('/register' , )

export default {userRouter}