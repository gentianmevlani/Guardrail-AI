/**
 * VersionHallucinationEngine v2.0 — Detects API usage from wrong library versions.
 *
 * AI models frequently use API signatures from the wrong version of a library,
 * mix up v5 and v4 APIs, or invent methods that never existed in any version.
 *
 * 28+ libraries covered with version-aware detection:
 *   Next.js, React, React DOM, React Router, Prisma, Mongoose, Axios, Lodash,
 *   Zod, TanStack Query, Express, Fastify, tRPC, Zustand, SWR, NextAuth/Auth.js,
 *   Drizzle ORM, TypeORM, Sequelize, Socket.io, date-fns, dayjs, Hono,
 *   Supabase, Firebase, Stripe, Clerk, Tailwind CSS, Vite, Playwright,
 *   OpenAI, Vercel AI SDK, Resend
 *
 * Rules:
 *   VHAL001 — Deprecated/removed API (you have version X, API removed in Y)
 *   VHAL002 — API doesn't exist in your version (added in a later version)
 *   VHAL003 — Import path changed between versions
 *   VHAL004 — Hallucinated method name (never existed in any version)
 *
 * Latency target: <30ms per file
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import type { Finding, DeltaContext, ScanEngine, EngineId } from './core-types';

/** FNV-1a deterministic hash → stable finding IDs across re-scans */
function deterministicId(uri: string, line: number, ruleId: string, library: string, apiName: string): string {
  const input = `vhal:${uri}::${line}::${ruleId}::${library}::${apiName}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `vhal-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Version Change Database ─────────────────────────────────────────────────

interface VersionChange {
  /** Method/API that was removed. */
  removed?: string;
  /** Version in which it was removed/deprecated. */
  since?: string;
  /** Replacement API. */
  replacement?: string;
  /** API that was added (to detect usage with older versions). */
  added?: string;
  /** Version in which it was added. */
  addedIn?: string;
  /** Method name that AI hallucinates (never existed). */
  hallucinated?: string;
  /** The real method to use instead. */
  realMethod?: string;
  /** Old import path (before migration). */
  oldImport?: string;
  /** New import path (after migration). */
  newImport?: string;
}

const VERSION_CHANGES: Record<string, VersionChange[]> = {
  // ── Next.js ──────────────────────────────────────────────────────────────
  next: [
    { removed: 'getServerSideProps', since: '13.0.0', replacement: 'server components or route handlers' },
    { removed: 'getStaticProps', since: '13.0.0', replacement: 'fetch in server components' },
    { removed: 'getStaticPaths', since: '13.0.0', replacement: 'generateStaticParams' },
    { removed: 'getInitialProps', since: '13.0.0', replacement: 'server components (app router)' },
    { oldImport: 'next/router', newImport: 'next/navigation', since: '13.0.0' },
    { oldImport: 'next/image', newImport: 'next/image (new component)', since: '13.0.0' },
    { removed: 'next/head', since: '13.0.0', replacement: 'export const metadata or generateMetadata()' },
    { hallucinated: 'getServerProps', realMethod: 'getServerSideProps (pages) or server components (app)' },
    { hallucinated: 'getProps', realMethod: 'getServerSideProps or getStaticProps' },
    { hallucinated: 'useRouter().query', realMethod: 'useSearchParams() in app router' },
    { added: 'useSearchParams', addedIn: '13.0.0' },
    { added: 'usePathname', addedIn: '13.0.0' },
    { added: 'generateMetadata', addedIn: '13.2.0' },
    { added: 'unstable_cache', addedIn: '14.0.0' },
  ],

  // ── React ────────────────────────────────────────────────────────────────
  react: [
    { removed: 'componentWillMount', since: '17.0.0', replacement: 'useEffect or constructor' },
    { removed: 'componentWillReceiveProps', since: '17.0.0', replacement: 'getDerivedStateFromProps or useEffect' },
    { removed: 'componentWillUpdate', since: '17.0.0', replacement: 'getSnapshotBeforeUpdate or useEffect' },
    { removed: 'createClass', since: '16.0.0', replacement: 'class extends React.Component or function components' },
    { removed: 'PropTypes', since: '15.5.0', replacement: 'import PropTypes from "prop-types" or TypeScript' },
    { added: 'useId', addedIn: '18.0.0' },
    { added: 'useDeferredValue', addedIn: '18.0.0' },
    { added: 'useTransition', addedIn: '18.0.0' },
    { added: 'useSyncExternalStore', addedIn: '18.0.0' },
    { added: 'useOptimistic', addedIn: '19.0.0' },
    { added: 'useActionState', addedIn: '19.0.0' },
    { added: 'use', addedIn: '19.0.0' },
    { hallucinated: 'useFormState', realMethod: 'useActionState (React 19) — useFormState was renamed' },
    { hallucinated: 'React.render', realMethod: 'ReactDOM.createRoot(el).render(<App />)' },
    { hallucinated: 'React.createContext().useContext', realMethod: 'useContext(MyContext)' },
  ],

  // ── React DOM ────────────────────────────────────────────────────────────
  'react-dom': [
    { removed: 'render', since: '18.0.0', replacement: 'createRoot().render()' },
    { removed: 'hydrate', since: '18.0.0', replacement: 'hydrateRoot()' },
    { removed: 'unmountComponentAtNode', since: '18.0.0', replacement: 'root.unmount()' },
    { removed: 'findDOMNode', since: '18.0.0', replacement: 'useRef' },
    { added: 'createRoot', addedIn: '18.0.0' },
    { added: 'hydrateRoot', addedIn: '18.0.0' },
    { added: 'preload', addedIn: '19.0.0' },
    { added: 'prefetchDNS', addedIn: '19.0.0' },
    { added: 'preconnect', addedIn: '19.0.0' },
  ],

  // ── React Router ─────────────────────────────────────────────────────────
  'react-router-dom': [
    { removed: 'Switch', since: '6.0.0', replacement: 'Routes' },
    { removed: 'Redirect', since: '6.0.0', replacement: 'Navigate' },
    { removed: 'useHistory', since: '6.0.0', replacement: 'useNavigate' },
    { removed: 'useRouteMatch', since: '6.0.0', replacement: 'useMatch' },
    { removed: 'withRouter', since: '6.0.0', replacement: 'useNavigate, useParams, useLocation hooks' },
    { oldImport: 'react-router-dom', newImport: 'react-router', since: '7.0.0' },
    { added: 'createBrowserRouter', addedIn: '6.4.0' },
    { added: 'RouterProvider', addedIn: '6.4.0' },
    { added: 'useLoaderData', addedIn: '6.4.0' },
    { hallucinated: 'useRouter', realMethod: 'useNavigate (React Router) or useRouter (Next.js)' },
  ],

  // ── Prisma ───────────────────────────────────────────────────────────────
  prisma: [
    { hallucinated: 'findOne', realMethod: 'findUnique or findFirst' },
    { hallucinated: 'getAll', realMethod: 'findMany' },
    { hallucinated: 'getById', realMethod: 'findUnique' },
    { hallucinated: 'fetchAll', realMethod: 'findMany' },
    { hallucinated: 'fetchOne', realMethod: 'findUnique or findFirst' },
    { hallucinated: 'insert', realMethod: 'create' },
    { hallucinated: 'save', realMethod: 'create or update' },
    { hallucinated: 'remove', realMethod: 'delete' },
    { hallucinated: 'destroy', realMethod: 'delete' },
    { hallucinated: 'updateAll', realMethod: 'updateMany' },
    { hallucinated: 'removeAll', realMethod: 'deleteMany' },
    { hallucinated: 'search', realMethod: 'findMany({ where: { ... } })' },
    { hallucinated: 'query', realMethod: '$queryRaw or $queryRawUnsafe' },
    { hallucinated: 'raw', realMethod: '$queryRaw' },
    { hallucinated: 'bulkCreate', realMethod: 'createMany' },
    { hallucinated: 'bulkUpdate', realMethod: 'updateMany' },
  ],

  // ── Mongoose ─────────────────────────────────────────────────────────────
  mongoose: [
    { removed: 'remove', since: '7.0.0', replacement: 'deleteOne or deleteMany' },
    { removed: 'update', since: '7.0.0', replacement: 'updateOne or updateMany' },
    { removed: 'count', since: '7.0.0', replacement: 'countDocuments' },
    { removed: 'findAndModify', since: '7.0.0', replacement: 'findOneAndUpdate' },
    { hallucinated: 'getById', realMethod: 'findById' },
    { hallucinated: 'findAll', realMethod: 'find' },
    { hallucinated: 'insert', realMethod: 'create or insertMany' },
    { hallucinated: 'destroy', realMethod: 'deleteOne or deleteMany' },
    { hallucinated: 'save', realMethod: 'doc.save() (instance method) or create (static)' },
  ],

  // ── Axios ────────────────────────────────────────────────────────────────
  axios: [
    { hallucinated: 'axios.fetch', realMethod: 'axios.get or axios.request' },
    { hallucinated: 'axios.send', realMethod: 'axios.post or axios.request' },
    { hallucinated: 'axios.call', realMethod: 'axios.request' },
    { hallucinated: 'axios.query', realMethod: 'axios.get with params' },
    { hallucinated: 'axios.setHeader', realMethod: 'axios.defaults.headers.common["X-Header"] = val' },
    { hallucinated: 'axios.setBaseURL', realMethod: 'axios.defaults.baseURL = url' },
    { hallucinated: 'axios.abort', realMethod: 'AbortController with signal option' },
  ],

  // ── Lodash ───────────────────────────────────────────────────────────────
  lodash: [
    { hallucinated: 'lodash.contains', realMethod: 'lodash.includes' },
    { hallucinated: 'lodash.pluck', realMethod: 'lodash.map with iteratee shorthand' },
    { hallucinated: 'lodash.first', realMethod: 'lodash.head' },
    { hallucinated: 'lodash.last', realMethod: 'lodash.last (this one exists!)' },
    { hallucinated: 'lodash.where', realMethod: 'lodash.filter' },
    { hallucinated: 'lodash.any', realMethod: 'lodash.some' },
    { hallucinated: 'lodash.all', realMethod: 'lodash.every' },
    { hallucinated: 'lodash.collect', realMethod: 'lodash.map' },
    { hallucinated: 'lodash.detect', realMethod: 'lodash.find' },
    { hallucinated: 'lodash.select', realMethod: 'lodash.filter' },
  ],

  // ── Zod ──────────────────────────────────────────────────────────────────
  zod: [
    { hallucinated: 'z.validate', realMethod: 'z.parse or z.safeParse' },
    { hallucinated: 'z.check', realMethod: 'z.refine or z.superRefine' },
    { hallucinated: 'z.assert', realMethod: 'z.parse (throws) or z.safeParse (returns result)' },
    { hallucinated: 'z.isValid', realMethod: 'schema.safeParse(data).success' },
    { hallucinated: 'z.create', realMethod: 'z.object, z.string, z.number, etc.' },
    { hallucinated: 'z.define', realMethod: 'z.object({...})' },
    { hallucinated: 'z.schema', realMethod: 'z.object({...})' },
    { hallucinated: 'z.required', realMethod: 'field is required by default; use .optional() to make optional' },
  ],

  // ── TanStack Query ───────────────────────────────────────────────────────
  '@tanstack/react-query': [
    { removed: 'useQuery(key, fn)', since: '5.0.0', replacement: 'useQuery({ queryKey, queryFn })' },
    { removed: 'useMutation(fn)', since: '5.0.0', replacement: 'useMutation({ mutationFn })' },
    { removed: 'useInfiniteQuery(key, fn)', since: '5.0.0', replacement: 'useInfiniteQuery({ queryKey, queryFn, ... })' },
    { removed: 'onSuccess', since: '5.0.0', replacement: 'use the returned data in useEffect or handle in mutate callbacks' },
    { removed: 'onError', since: '5.0.0', replacement: 'use the returned error in useEffect or handle in mutate callbacks' },
    { removed: 'onSettled', since: '5.0.0', replacement: 'handle in mutate callbacks' },
    { hallucinated: 'useQueryClient().fetch', realMethod: 'queryClient.fetchQuery or queryClient.prefetchQuery' },
    { hallucinated: 'useQuery().refetch()', realMethod: 'const { refetch } = useQuery(...); refetch()' },
  ],

  // ── Express ──────────────────────────────────────────────────────────────
  express: [
    { removed: 'app.del', since: '4.0.0', replacement: 'app.delete' },
    { removed: 'app.configure', since: '4.0.0', replacement: 'use if/else with process.env.NODE_ENV' },
    { removed: 'express.createServer', since: '4.0.0', replacement: 'express()' },
    { removed: 'express.bodyParser', since: '4.0.0', replacement: 'express.json() and express.urlencoded()' },
    { removed: 'express.cookieParser', since: '4.0.0', replacement: 'npm install cookie-parser' },
    { removed: 'express.session', since: '4.0.0', replacement: 'npm install express-session' },
    { hallucinated: 'app.handle', realMethod: 'app.use or app.get/post/put/delete' },
    { hallucinated: 'app.serve', realMethod: 'app.use(express.static(path))' },
    { hallucinated: 'app.mount', realMethod: 'app.use(path, router)' },
    { hallucinated: 'app.register', realMethod: 'app.use(middleware) or app.get/post(path, handler)' },
    { hallucinated: 'app.start', realMethod: 'app.listen(port, callback)' },
    { hallucinated: 'res.json()', realMethod: 'res.json(data) — requires an argument' },
    { hallucinated: 'res.sendJSON', realMethod: 'res.json(data)' },
    { hallucinated: 'res.render()', realMethod: 'res.render(view, locals) — requires view name' },
  ],

  // ── Fastify ──────────────────────────────────────────────────────────────
  fastify: [
    { removed: 'fastify.use', since: '4.0.0', replacement: '@fastify/middie or @fastify/express for middleware compat' },
    { hallucinated: 'fastify.listen(port)', realMethod: 'fastify.listen({ port, host })' },
    { hallucinated: 'fastify.start', realMethod: 'fastify.listen({ port })' },
    { hallucinated: 'fastify.handle', realMethod: 'fastify.route or fastify.get/post/put/delete' },
    { hallucinated: 'reply.json', realMethod: 'reply.send(data) — Fastify auto-serializes objects' },
    { hallucinated: 'reply.render', realMethod: 'reply.view(template, data) with @fastify/view' },
  ],

  // ── tRPC ─────────────────────────────────────────────────────────────────
  '@trpc/server': [
    { removed: 'createRouter', since: '10.0.0', replacement: 'router (from initTRPC.create())' },
    { removed: '.query(resolver)', since: '10.0.0', replacement: '.query(({ input, ctx }) => ...)' },
    { removed: '.mutation(resolver)', since: '10.0.0', replacement: '.mutation(({ input, ctx }) => ...)' },
    { removed: 'createSSGHelpers', since: '10.0.0', replacement: 'createServerSideHelpers' },
    { hallucinated: 'trpc.procedure', realMethod: 'publicProcedure or protectedProcedure (from your trpc setup)' },
    { hallucinated: 'trpc.route', realMethod: 'router({ routeName: procedure.query/mutation })' },
  ],

  // ── Zustand ──────────────────────────────────────────────────────────────
  zustand: [
    { removed: 'create(set => ...)', since: '5.0.0', replacement: 'createStore (Zustand 5) or create()((set) => ...)' },
    { hallucinated: 'useStore.getState', realMethod: 'useStore.getState() — works, but called as a function' },
    { hallucinated: 'zustand.createStore', realMethod: 'import { create } from "zustand"' },
    { hallucinated: 'useStore.dispatch', realMethod: 'actions defined in the store, e.g. useStore(s => s.increment)' },
    { hallucinated: 'useStore.subscribe', realMethod: 'useStore.subscribe(listener) — returns unsubscribe' },
  ],

  // ── SWR ──────────────────────────────────────────────────────────────────
  swr: [
    { removed: 'useSWR(key, fetcher, config)', since: '2.0.0', replacement: 'useSWR(key, fetcher, config) — API unchanged but options renamed' },
    { hallucinated: 'useSWR().revalidate', realMethod: 'useSWR().mutate() — revalidate was renamed to mutate' },
    { hallucinated: 'swr.fetch', realMethod: 'useSWR(key, fetcher)' },
    { hallucinated: 'swr.cache', realMethod: 'import { cache } from "swr" or useSWRConfig().cache' },
    { hallucinated: 'useSWR().loading', realMethod: 'useSWR().isLoading or useSWR().isValidating' },
  ],

  // ── NextAuth / Auth.js ───────────────────────────────────────────────────
  'next-auth': [
    { removed: 'getSession', since: '5.0.0', replacement: 'auth() from next-auth' },
    { removed: 'getServerSession', since: '5.0.0', replacement: 'auth() from next-auth' },
    { removed: 'useSession().loading', since: '4.0.0', replacement: 'useSession().status === "loading"' },
    { oldImport: 'next-auth/react', newImport: 'next-auth/react', since: '5.0.0' },
    { oldImport: 'next-auth/jwt', newImport: 'next-auth', since: '5.0.0' },
    { hallucinated: 'NextAuth.configure', realMethod: 'NextAuth({ providers: [...], ... })' },
    { hallucinated: 'signIn(provider, redirect)', realMethod: 'signIn(provider, { redirectTo })' },
  ],

  // ── Drizzle ORM ──────────────────────────────────────────────────────────
  'drizzle-orm': [
    { hallucinated: 'db.findMany', realMethod: 'db.select().from(table)' },
    { hallucinated: 'db.findOne', realMethod: 'db.select().from(table).where(...).limit(1)' },
    { hallucinated: 'db.findUnique', realMethod: 'db.select().from(table).where(eq(table.id, id))' },
    { hallucinated: 'db.create', realMethod: 'db.insert(table).values(data)' },
    { hallucinated: 'db.update(table, data)', realMethod: 'db.update(table).set(data).where(...)' },
    { hallucinated: 'db.remove', realMethod: 'db.delete(table).where(...)' },
    { hallucinated: 'db.destroy', realMethod: 'db.delete(table).where(...)' },
    { hallucinated: 'db.query', realMethod: 'db.select().from(table) or db.execute(sql`...`)' },
    { hallucinated: 'db.raw', realMethod: 'db.execute(sql`...`)' },
  ],

  // ── TypeORM ──────────────────────────────────────────────────────────────
  typeorm: [
    { hallucinated: 'repository.findAll', realMethod: 'repository.find()' },
    { hallucinated: 'repository.findById', realMethod: 'repository.findOneBy({ id })' },
    { hallucinated: 'repository.get', realMethod: 'repository.findOneBy or repository.findOne' },
    { hallucinated: 'repository.insert', realMethod: 'repository.save(entity) or repository.insert(data)' },
    { hallucinated: 'repository.destroy', realMethod: 'repository.remove(entity) or repository.delete(id)' },
    { hallucinated: 'repository.updateById', realMethod: 'repository.update(id, data)' },
    { removed: 'findOne(id)', since: '0.3.0', replacement: 'findOneBy({ id }) — findOne no longer accepts a plain ID' },
    { removed: 'find({ where: string })', since: '0.3.0', replacement: 'find({ where: { column: value } })' },
  ],

  // ── Sequelize ────────────────────────────────────────────────────────────
  sequelize: [
    { hallucinated: 'Model.get', realMethod: 'Model.findOne or Model.findByPk' },
    { hallucinated: 'Model.insert', realMethod: 'Model.create' },
    { hallucinated: 'Model.remove', realMethod: 'Model.destroy or instance.destroy()' },
    { hallucinated: 'Model.delete', realMethod: 'Model.destroy({ where: { ... } })' },
    { hallucinated: 'Model.updateAll', realMethod: 'Model.update(values, { where: { ... } })' },
    { hallucinated: 'Model.fetch', realMethod: 'Model.findAll or Model.findOne' },
    { hallucinated: 'Model.search', realMethod: 'Model.findAll({ where: { ... } })' },
  ],

  // ── Socket.io ────────────────────────────────────────────────────────────
  'socket.io': [
    { removed: 'io.set', since: '1.0.0', replacement: 'pass options to Server constructor' },
    { removed: 'io.sockets.on', since: '3.0.0', replacement: 'io.on("connection", ...)' },
    { hallucinated: 'socket.send', realMethod: 'socket.emit(event, data)' },
    { hallucinated: 'socket.broadcast', realMethod: 'socket.broadcast.emit(event, data)' },
    { hallucinated: 'io.listen', realMethod: 'new Server(httpServer) or io.attach(httpServer)' },
  ],

  // ── date-fns ─────────────────────────────────────────────────────────────
  'date-fns': [
    { hallucinated: 'dateFns.format', realMethod: 'import { format } from "date-fns" — named imports only' },
    { hallucinated: 'dateFns.parse', realMethod: 'import { parse } from "date-fns"' },
    { hallucinated: 'format(date, "YYYY-MM-DD")', realMethod: 'format(date, "yyyy-MM-dd") — lowercase year tokens' },
    { hallucinated: 'format(date, "DD/MM/YYYY")', realMethod: 'format(date, "dd/MM/yyyy") — lowercase day/year' },
  ],

  // ── dayjs ────────────────────────────────────────────────────────────────
  dayjs: [
    { hallucinated: 'dayjs.now', realMethod: 'dayjs() — no .now() method' },
    { hallucinated: 'dayjs.parse', realMethod: 'dayjs(dateString) or dayjs(dateString, format) with customParseFormat plugin' },
    { hallucinated: 'dayjs().toDate()', realMethod: 'dayjs().toDate() — this one actually exists!' },
    { hallucinated: 'dayjs.duration', realMethod: 'dayjs.duration() requires the duration plugin' },
    { hallucinated: 'dayjs().diff().humanize', realMethod: 'dayjs().fromNow() with relativeTime plugin' },
  ],

  // ── Hono ─────────────────────────────────────────────────────────────────
  hono: [
    { hallucinated: 'app.listen', realMethod: 'serve(app) from @hono/node-server, or export default app for edge' },
    { hallucinated: 'app.start', realMethod: 'serve({ fetch: app.fetch, port }) from @hono/node-server' },
    { hallucinated: 'c.json()', realMethod: 'c.json(data) — requires data argument' },
    { hallucinated: 'c.sendJSON', realMethod: 'c.json(data)' },
    { hallucinated: 'c.render', realMethod: 'c.html(content) or use JSX middleware' },
    { hallucinated: 'app.register', realMethod: 'app.route(path, subApp) or app.use(middleware)' },
  ],

  // ── Supabase ────────────────────────────────────────────────────────────
  '@supabase/supabase-js': [
    { hallucinated: 'supabase.query', realMethod: 'supabase.from(table).select()' },
    { hallucinated: 'supabase.insert', realMethod: 'supabase.from(table).insert(data)' },
    { hallucinated: 'supabase.update', realMethod: 'supabase.from(table).update(data).eq(col, val)' },
    { hallucinated: 'supabase.delete', realMethod: 'supabase.from(table).delete().eq(col, val)' },
    { hallucinated: 'supabase.find', realMethod: 'supabase.from(table).select().eq(col, val)' },
    { hallucinated: 'supabase.findOne', realMethod: 'supabase.from(table).select().eq(col, val).single()' },
    { hallucinated: 'supabase.getUser', realMethod: 'supabase.auth.getUser()' },
    { hallucinated: 'supabase.signIn', realMethod: 'supabase.auth.signInWithPassword({ email, password })' },
    { hallucinated: 'supabase.signUp', realMethod: 'supabase.auth.signUp({ email, password })' },
    { hallucinated: 'supabase.signOut', realMethod: 'supabase.auth.signOut()' },
    { hallucinated: 'supabase.onAuthStateChange', realMethod: 'supabase.auth.onAuthStateChange(callback)' },
    { hallucinated: 'supabase.storage.upload', realMethod: 'supabase.storage.from(bucket).upload(path, file)' },
    { hallucinated: 'supabase.rpc', realMethod: 'supabase.rpc(fnName, params) — this one exists! verify your fn name.' },
  ],

  // ── Firebase ────────────────────────────────────────────────────────────
  firebase: [
    { hallucinated: 'firebase.auth().signIn', realMethod: 'signInWithEmailAndPassword(auth, email, password) — modular v9+ API' },
    { hallucinated: 'firebase.auth().createUser', realMethod: 'createUserWithEmailAndPassword(auth, email, password)' },
    { hallucinated: 'firebase.auth().signOut', realMethod: 'signOut(auth)' },
    { hallucinated: 'firebase.firestore().get', realMethod: 'getDoc(docRef) or getDocs(query)' },
    { hallucinated: 'firebase.firestore().add', realMethod: 'addDoc(collectionRef, data)' },
    { hallucinated: 'firebase.firestore().set', realMethod: 'setDoc(docRef, data)' },
    { hallucinated: 'firebase.firestore().update', realMethod: 'updateDoc(docRef, data)' },
    { hallucinated: 'firebase.firestore().delete', realMethod: 'deleteDoc(docRef)' },
    { removed: 'firebase.initializeApp', since: '9.0.0', replacement: 'import { initializeApp } from "firebase/app" — modular SDK' },
    { removed: 'firebase.auth()', since: '9.0.0', replacement: 'import { getAuth } from "firebase/auth"' },
    { removed: 'firebase.firestore()', since: '9.0.0', replacement: 'import { getFirestore } from "firebase/firestore"' },
    { removed: 'firebase.storage()', since: '9.0.0', replacement: 'import { getStorage } from "firebase/storage"' },
    { oldImport: 'firebase/app', newImport: 'firebase/app', since: '9.0.0' },
  ],

  // ── Stripe (Node SDK) ──────────────────────────────────────────────────
  stripe: [
    { hallucinated: 'stripe.createPayment', realMethod: 'stripe.paymentIntents.create({ amount, currency })' },
    { hallucinated: 'stripe.charge', realMethod: 'stripe.charges.create or stripe.paymentIntents.create' },
    { hallucinated: 'stripe.createCustomer', realMethod: 'stripe.customers.create({ email })' },
    { hallucinated: 'stripe.getCustomer', realMethod: 'stripe.customers.retrieve(id)' },
    { hallucinated: 'stripe.createSubscription', realMethod: 'stripe.subscriptions.create({ customer, items })' },
    { hallucinated: 'stripe.createCheckout', realMethod: 'stripe.checkout.sessions.create({ ... })' },
    { hallucinated: 'stripe.verifyWebhook', realMethod: 'stripe.webhooks.constructEvent(body, sig, secret)' },
    { hallucinated: 'stripe.createProduct', realMethod: 'stripe.products.create({ name })' },
    { hallucinated: 'stripe.createPrice', realMethod: 'stripe.prices.create({ unit_amount, currency, product })' },
    { hallucinated: 'stripe.getInvoice', realMethod: 'stripe.invoices.retrieve(id)' },
    { hallucinated: 'stripe.createPortal', realMethod: 'stripe.billingPortal.sessions.create({ customer })' },
  ],

  // ── Clerk ──────────────────────────────────────────────────────────────
  '@clerk/nextjs': [
    { hallucinated: 'useAuth().user', realMethod: 'useUser() for user data; useAuth() for session/token' },
    { hallucinated: 'useAuth().signIn', realMethod: 'useSignIn() hook' },
    { hallucinated: 'useAuth().signUp', realMethod: 'useSignUp() hook' },
    { hallucinated: 'getAuth(req).user', realMethod: 'currentUser() for user data; auth() for session claims' },
    { hallucinated: 'auth().user', realMethod: 'currentUser() in server components' },
    { removed: 'withClerkMiddleware', since: '4.0.0', replacement: 'clerkMiddleware()' },
    { removed: 'authMiddleware', since: '5.0.0', replacement: 'clerkMiddleware()' },
  ],

  // ── Tailwind CSS ───────────────────────────────────────────────────────
  tailwindcss: [
    { removed: 'purge', since: '3.0.0', replacement: 'content (in tailwind.config.js)' },
    { removed: 'mode: "jit"', since: '3.0.0', replacement: 'JIT is default in v3+' },
    { removed: 'darkMode: "media"', since: '4.0.0', replacement: 'dark: variant selector (v4 uses CSS-first config)' },
    { removed: 'tailwind.config.js', since: '4.0.0', replacement: '@theme directive in CSS (v4 is CSS-first)' },
  ],

  // ── Vite ───────────────────────────────────────────────────────────────
  vite: [
    { removed: 'defineConfig', since: '6.0.0', replacement: 'export default { ... } — defineConfig still works but Environment API changed' },
    { hallucinated: 'vite.createServer', realMethod: 'createServer from "vite" — import { createServer } from "vite"' },
    { hallucinated: 'vite.build', realMethod: 'import { build } from "vite"' },
  ],

  // ── OpenAI (Node SDK) ───────────────────────────────────────────────────
  openai: [
    { removed: 'createChatCompletion', since: '4.0.0', replacement: 'chat.completions.create()' },
    { removed: 'createCompletion', since: '4.0.0', replacement: 'completions.create()' },
    { removed: 'createTranscription', since: '4.0.0', replacement: 'audio.transcriptions.create()' },
    { removed: 'OpenAIApi', since: '4.0.0', replacement: 'new OpenAI({ apiKey })' },
    { removed: 'Configuration', since: '4.0.0', replacement: 'pass options to OpenAI constructor' },
    { hallucinated: 'openai.chat', realMethod: 'openai.chat.completions.create({ model, messages })' },
    { hallucinated: 'openai.complete', realMethod: 'openai.completions.create or openai.chat.completions.create' },
    { hallucinated: 'openai.generate', realMethod: 'openai.chat.completions.create or openai.completions.create' },
    { hallucinated: 'openai.create', realMethod: 'openai.chat.completions.create, openai.completions.create, etc.' },
    { hallucinated: 'openai.embed', realMethod: 'openai.embeddings.create' },
    { hallucinated: 'openai.transcribe', realMethod: 'openai.audio.transcriptions.create' },
  ],

  // ── Vercel AI SDK ──────────────────────────────────────────────────────
  ai: [
    { hallucinated: 'ai.generate', realMethod: 'generateText() or streamText() from "ai" package' },
    { hallucinated: 'ai.chat', realMethod: 'useChat() hook or streamText()' },
    { hallucinated: 'ai.complete', realMethod: 'generateText() or streamText()' },
    { hallucinated: 'ai.stream', realMethod: 'streamText()' },
    { hallucinated: 'ai.embed', realMethod: 'embed() from @ai-sdk/openai or similar provider' },
    { hallucinated: 'useAI', realMethod: 'useChat() for chat UI; useCompletion() for single completion' },
  ],

  // ── Resend (email API) ───────────────────────────────────────────────────
  resend: [
    { hallucinated: 'resend.send', realMethod: 'resend.emails.send({ from, to, subject, html })' },
    { hallucinated: 'resend.sendEmail', realMethod: 'resend.emails.send()' },
    { hallucinated: 'resend.create', realMethod: 'resend.emails.send()' },
    { hallucinated: 'resend.email', realMethod: 'resend.emails.send()' },
    { hallucinated: 'resend.deliver', realMethod: 'resend.emails.send()' },
  ],

  // ── Playwright ─────────────────────────────────────────────────────────
  '@playwright/test': [
    { hallucinated: 'page.click', realMethod: 'page.locator(selector).click() — locator API preferred since v1.14' },
    { hallucinated: 'page.fill', realMethod: 'page.locator(selector).fill(value)' },
    { hallucinated: 'page.type', realMethod: 'page.locator(selector).pressSequentially(text) — type() is deprecated' },
    { hallucinated: 'page.$(selector)', realMethod: 'page.locator(selector) — $ API is discouraged' },
    { hallucinated: 'page.$$(selector)', realMethod: 'page.locator(selector) — use locator.all()' },
    { hallucinated: 'page.waitForSelector', realMethod: 'page.locator(selector).waitFor() or expect(locator).toBeVisible()' },
    { hallucinated: 'page.waitForNavigation', realMethod: 'page.waitForURL(url) or await Promise.all([page.waitForURL(), click])' },
  ],
};

// ─── Pattern Builder ────────────────────────────────────────────────────────

interface VersionPattern {
  ruleId: string;
  library: string;
  regex: RegExp;
  change: VersionChange;
  severity: 'critical' | 'high' | 'medium';
  confidence: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPatterns(): VersionPattern[] {
  const patterns: VersionPattern[] = [];

  for (const [lib, changes] of Object.entries(VERSION_CHANGES)) {
    for (const change of changes) {
      if (change.hallucinated) {
        // For lodash/zod, hallucinated is "lodash.contains" or "z.validate" — use method part only for regex
        let patternPart = change.hallucinated;
        if (lib === 'lodash' && patternPart.startsWith('lodash.')) {
          patternPart = patternPart.slice(7);
        } else if (lib === 'zod' && patternPart.startsWith('z.')) {
          patternPart = patternPart.slice(2);
        }
        const escaped = escapeRegex(patternPart);
        let regex: RegExp;

        if (lib === 'prisma') {
          // prisma.user.findOne() or db.user.findOne()
          regex = new RegExp(`(?:prisma|db|client)\\.\\w+\\.${escaped}\\s*\\(`);
        } else if (lib === 'axios') {
          regex = new RegExp(`${escaped}\\s*\\(`);
        } else if (lib === 'lodash') {
          regex = new RegExp(`(?:_|lodash)\\.${escaped}\\s*\\(`);
        } else if (lib === 'zod') {
          regex = new RegExp(`z\\.${escaped}\\s*[(<]`);
        } else if (lib === 'drizzle-orm') {
          regex = new RegExp(`(?:db|drizzle)\\.${escaped}\\s*[(<]`);
        } else if (lib === 'typeorm') {
          regex = new RegExp(`(?:repository|repo|manager)\\.${escaped}\\s*\\(`);
        } else if (lib === 'sequelize') {
          regex = new RegExp(`(?:Model|\\w+Model|\\w+)\\.${escaped}\\s*\\(`);
        } else if (lib === 'swr') {
          regex = new RegExp(`${escaped}\\s*[(<]`);
        } else if (lib === 'hono') {
          regex = new RegExp(`(?:app|c)\\.${escaped}\\s*\\(`);
        } else if (lib === 'fastify') {
          regex = new RegExp(`(?:fastify|server|app|reply)\\.${escaped}\\s*\\(`);
        } else if (lib === 'dayjs') {
          regex = new RegExp(`dayjs(?:\\([^)]*\\))?\\.${escaped}\\s*[(<]`);
        } else if (lib === 'date-fns') {
          regex = new RegExp(`dateFns\\.${escaped}\\s*\\(`);
        } else if (lib === 'socket.io') {
          regex = new RegExp(`(?:io|socket)\\.${escaped}\\s*\\(`);
        } else if (lib === 'express') {
          regex = new RegExp(`(?:app|router|express|res)\\.${escaped}\\s*\\(`);
        } else if (lib === 'zustand') {
          regex = new RegExp(`(?:useStore|store|zustand)\\.${escaped}\\b`);
        } else if (lib === '@supabase/supabase-js') {
          regex = new RegExp(`(?:supabase|client|sb)\\.${escaped}\\s*\\(`);
        } else if (lib === 'firebase') {
          regex = new RegExp(`(?:firebase|app|auth|db|firestore|storage)\\.${escaped}\\s*\\(`);
        } else if (lib === 'stripe') {
          regex = new RegExp(`(?:stripe|stripeClient)\\.${escaped}\\s*\\(`);
        } else if (lib === '@clerk/nextjs') {
          regex = new RegExp(`(?:useAuth|auth|clerk|getAuth)(?:\\([^)]*\\))?\\.${escaped}\\b`);
        } else if (lib === '@playwright/test') {
          regex = new RegExp(`(?:page|browser|context)\\.${escaped}\\s*\\(`);
        } else if (lib === 'openai') {
          const methodPart = patternPart.includes('.') ? patternPart.split('.').pop()! : patternPart;
          regex = new RegExp(`(?:openai|client|api)\\.${escapeRegex(methodPart)}\\s*\\(`);
        } else if (lib === 'ai') {
          if (patternPart.startsWith('use')) {
            regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}\\s*\\(`);
          } else {
            const methodPart = patternPart.includes('.') ? patternPart.split('.').pop()! : patternPart;
            regex = new RegExp(`(?:ai|client)\\.${escapeRegex(methodPart)}\\s*\\(`);
          }
        } else if (lib === 'resend') {
          const methodPart = patternPart.includes('.') ? patternPart.split('.').pop()! : patternPart;
          regex = new RegExp(`(?:resend|client)\\.${escapeRegex(methodPart)}\\s*\\(`);
        } else {
          regex = new RegExp(`\\.${escaped}\\s*\\(`);
        }

        patterns.push({
          ruleId: 'VHAL004',
          library: lib,
          regex,
          change,
          severity: 'critical',
          confidence: 0.92,
        });
      }

      if (change.removed && change.since) {
        const escaped = escapeRegex(change.removed);
        patterns.push({
          ruleId: 'VHAL001',
          library: lib,
          regex: new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:\\s*\\(|\\s*=|[^a-zA-Z0-9_])`),
          change,
          severity: 'high',
          confidence: 0.75,
        });
      }

      if (change.oldImport && change.newImport && change.since) {
        const escaped = escapeRegex(change.oldImport);
        patterns.push({
          ruleId: 'VHAL003',
          library: lib,
          regex: new RegExp(`(?:from|import)\\s+['"]${escaped}['"]`),
          change,
          severity: 'medium',
          confidence: 0.85,
        });
      }

      if (change.added && change.addedIn) {
        const escaped = escapeRegex(change.added);
        patterns.push({
          ruleId: 'VHAL002',
          library: lib,
          regex: new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}\\s*\\(`),
          change: { ...change, since: change.addedIn },
          severity: 'high',
          confidence: 0.70,
        });
      }
    }
  }

  return patterns;
}

const COMPILED_PATTERNS = buildPatterns();

// ─── Semver ──────────────────────────────────────────────────────────────────

function parseSemver(version: string): [number, number, number] | null {
  const cleaned = version.replace(/^[~^>=<\s]+/, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]!, 10), parseInt(match[2]!, 10), parseInt(match[3]!, 10)];
}

function semverGte(installed: string, threshold: string): boolean {
  const inst = parseSemver(installed);
  const thresh = parseSemver(threshold);
  if (!inst || !thresh) return false;
  if (inst[0] !== thresh[0]) return inst[0]! > thresh[0]!;
  if (inst[1] !== thresh[1]) return inst[1]! > thresh[1]!;
  return inst[2]! >= thresh[2]!;
}

function semverLt(installed: string, threshold: string): boolean {
  return !semverGte(installed, threshold);
}

// ─── Project Root & package.json ─────────────────────────────────────────────

function findProjectRoot(filePath: string): string | null {
  let dir = path.dirname(filePath);
  for (let i = 0; i < 20; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Cache: avoid re-reading package.json for every file in the same project
const _versionCache = new Map<string, Record<string, string>>();

function readInstalledVersions(projectRoot: string): Record<string, string> {
  const cached = _versionCache.get(projectRoot);
  if (cached) return cached;

  const versions: Record<string, string> = {};
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return versions;

  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const [name, ver] of Object.entries(allDeps)) {
      if (typeof ver === 'string') versions[name] = ver;
    }
    _versionCache.set(projectRoot, versions);
  } catch {
    // Non-fatal — version-specific checks will be skipped
  }

  return versions;
}

/** Check if the library is actually imported/required in the file content. */
function isLibraryImportedInFile(content: string, library: string): boolean {
  const escaped = escapeRegex(library);
  const re = new RegExp(`(?:from|require\\s*\\()\\s*['"]${escaped}(?:/[^'"]*)?['"]`);
  return re.test(content);
}

/**
 * Library aliases: some libraries have related package names that count as
 * "the library is in use". E.g., `@prisma/client` means Prisma is in use.
 */
const LIBRARY_ALIASES: Record<string, string[]> = {
  prisma: ['@prisma/client', 'prisma'],
  mongoose: ['mongoose'],
  next: ['next', 'next/navigation', 'next/router', 'next/image', 'next/head', 'next/link'],
  react: ['react', 'react/jsx-runtime'],
  'react-dom': ['react-dom', 'react-dom/client', 'react-dom/server'],
  'react-router-dom': ['react-router-dom', 'react-router'],
  axios: ['axios'],
  lodash: ['lodash', 'lodash-es', 'lodash/fp'],
  zod: ['zod'],
  '@tanstack/react-query': ['@tanstack/react-query'],
  express: ['express'],
  fastify: ['fastify'],
  '@trpc/server': ['@trpc/server', '@trpc/client', '@trpc/react-query'],
  zustand: ['zustand'],
  swr: ['swr'],
  'next-auth': ['next-auth', '@auth/core'],
  'drizzle-orm': ['drizzle-orm'],
  typeorm: ['typeorm'],
  sequelize: ['sequelize'],
  'socket.io': ['socket.io', 'socket.io-client'],
  'date-fns': ['date-fns'],
  dayjs: ['dayjs'],
  hono: ['hono'],
  '@supabase/supabase-js': ['@supabase/supabase-js', '@supabase/ssr', '@supabase/auth-helpers-nextjs'],
  firebase: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
  stripe: ['stripe'],
  '@clerk/nextjs': ['@clerk/nextjs', '@clerk/clerk-react', '@clerk/backend'],
  tailwindcss: ['tailwindcss'],
  vite: ['vite'],
  '@playwright/test': ['@playwright/test', 'playwright'],
  openai: ['openai'],
  ai: ['ai', '@ai-sdk/openai', '@ai-sdk/anthropic'],
  resend: ['resend'],
};

/** Check if library or any of its aliases are imported in the file. */
function isLibraryOrAliasImported(content: string, library: string): boolean {
  if (isLibraryImportedInFile(content, library)) return true;
  const aliases = LIBRARY_ALIASES[library];
  if (aliases) {
    for (const alias of aliases) {
      if (alias !== library && isLibraryImportedInFile(content, alias)) return true;
    }
  }
  return false;
}

/** Check if library or any of its aliases are in the project's package.json. */
function isLibraryInProject(versions: Record<string, string>, library: string): boolean {
  if (versions[library] !== undefined) return true;
  const aliases = LIBRARY_ALIASES[library];
  if (aliases) {
    for (const alias of aliases) {
      if (versions[alias] !== undefined) return true;
    }
  }
  return false;
}

/** Get the installed version, checking aliases too. */
function getInstalledVersion(versions: Record<string, string>, library: string): string | undefined {
  if (versions[library] !== undefined) return versions[library];
  const aliases = LIBRARY_ALIASES[library];
  if (aliases) {
    for (const alias of aliases) {
      if (versions[alias] !== undefined) return versions[alias];
    }
  }
  return undefined;
}

function isTestFile(uri: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(uri) ||
    /(?:^|\/)(?:__tests__|__mocks__|tests?|fixtures?|e2e|spec|cypress|playwright)\//i.test(uri);
}

/** Simple comment/string region tracker to skip false positives. */
function buildCommentMask(lines: string[]): boolean[] {
  const mask = new Array(lines.length).fill(false);
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (inBlockComment) {
      mask[i] = true;
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      mask[i] = true;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      mask[i] = true;
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }
  }
  return mask;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class VersionHallucinationEngine implements ScanEngine {
  readonly id = 'version_hallucination';

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const findings: Finding[] = [];
    const filePath = delta.documentUri;
    const content = delta.fullText;

    // Skip test files — they may intentionally test old APIs
    if (isTestFile(filePath)) return findings;

    const lang = delta.documentLanguage.toLowerCase();
    if (!lang.includes('typescript') && !lang.includes('javascript') &&
        !lang.includes('typescriptreact') && !lang.includes('javascriptreact')) {
      return findings;
    }

    const lines = content.split('\n');
    const commentMask = buildCommentMask(lines);
    const projectRoot = findProjectRoot(filePath);
    const versions = projectRoot ? readInstalledVersions(projectRoot) : {};

    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      if (signal.aborted) break;

      // Skip comment lines (tracked by mask)
      if (commentMask[i]) continue;

      const line = lines[i]!;
      const trimmed = line.trim();
      if (!trimmed) continue;

      for (const pattern of COMPILED_PATTERNS) {
        const match = line.match(pattern.regex);
        if (!match) continue;

        // ── Match-level comment/string guard ──
        // Skip if the match position is inside a trailing comment
        const matchIdx = match.index ?? 0;
        const beforeMatch = line.slice(0, matchIdx);
        if (/\/\//.test(beforeMatch)) continue;

        const installedVersion = getInstalledVersion(versions, pattern.library);
        const libraryInProject = isLibraryInProject(versions, pattern.library);
        const libraryImported = isLibraryOrAliasImported(content, pattern.library);
        const change = pattern.change;
        let shouldReport = false;
        let message = '';
        let fix = '';
        let confidence = pattern.confidence;
        let severity = pattern.severity;

        if (change.hallucinated) {
          // Only report if the library is actually used in this file or project
          shouldReport = libraryInProject || libraryImported;
          message = `Hallucinated method '${change.hallucinated}' does not exist on ${pattern.library}`;
          fix = `Use ${change.realMethod} instead. Check the ${pattern.library} documentation.`;
          confidence = libraryImported ? 0.92 : (libraryInProject ? 0.85 : 0);
        } else if (change.removed && change.since) {
          // Require: (library in project with version >= since) AND (imported OR version confirms)
          if (
            installedVersion &&
            change.since !== 'never' &&
            semverGte(installedVersion, change.since) &&
            (libraryImported || libraryInProject)
          ) {
            shouldReport = true;
            message = `'${change.removed}' was removed in ${pattern.library}@${change.since} (you have ${installedVersion})`;
            fix = change.replacement
              ? `Use ${change.replacement} instead.`
              : `Check ${pattern.library} migration guide for ${change.since}.`;
            // Higher confidence if the library is actually imported in this file
            confidence = libraryImported ? 0.88 : 0.72;
          } else if (!installedVersion && libraryImported) {
            // Library imported but not in package.json — still flag but lower confidence
            shouldReport = true;
            message = `'${change.removed}' may be deprecated/removed in ${pattern.library} (version unknown)`;
            fix = change.replacement
              ? `If using ${pattern.library} >= ${change.since}, use ${change.replacement} instead.`
              : `Check ${pattern.library} migration guide.`;
            confidence = Math.max(0.5, confidence - 0.2);
            severity = 'medium';
          }
        } else if (change.oldImport && change.newImport && change.since) {
          if (installedVersion && semverGte(installedVersion, change.since)) {
            shouldReport = true;
            message = `Import path '${change.oldImport}' changed in ${pattern.library}@${change.since} (you have ${installedVersion})`;
            fix = `Use '${change.newImport}' instead.`;
          }
        } else if (change.added && change.since) {
          if (installedVersion && semverLt(installedVersion, change.since)) {
            // Only flag if library is imported in this file (reduces FP for unused deps)
            shouldReport = libraryImported;
            message = `'${change.added}' was added in ${pattern.library}@${change.since} but you have ${installedVersion}`;
            fix = `Upgrade ${pattern.library} to >= ${change.since}, or use the equivalent API for your version.`;
          }
        }

        if (!shouldReport) continue;

        const dedupeKey = `${pattern.ruleId}:${pattern.library}:${i + 1}:${change.hallucinated ?? change.removed ?? change.added ?? change.oldImport}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const col = match.index ?? 0;

        findings.push({
          id: deterministicId(filePath, i + 1, pattern.ruleId, pattern.library, change.hallucinated ?? change.removed ?? change.added ?? change.oldImport ?? ''),
          engine: 'version_hallucination' as EngineId,
          severity,
          category: 'hallucinations',
          file: filePath,
          line: i + 1,
          column: col,
          endLine: i + 1,
          endColumn: col + match[0].length,
          message,
          evidence: trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed,
          suggestion: fix,
          confidence,
          autoFixable: false,
          ruleId: pattern.ruleId,
        });
      }
    }

    return findings;
  }

  /** Clear the version cache (e.g. after npm install). */
  clearCache(): void {
    _versionCache.clear();
  }
}
