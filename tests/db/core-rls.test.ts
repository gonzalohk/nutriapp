import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, errorOf, type TestDb } from './harness'

let db: TestDb
let alice: string // owner of household A
let bob: string // joins household A
let carol: string // a stranger with no household
let householdA: string

beforeAll(async () => {
  db = await createDb()
  alice = await db.createUser('alice@example.com')
  bob = await db.createUser('bob@example.com')
  carol = await db.createUser('carol@example.com')
  householdA = await db.asUser(alice, async () => {
    const r = await db.pg.query<{ create_household: string }>(
      `select create_household('Casa A', 'Alice')`,
    )
    return r.rows[0]!.create_household
  })
})

afterAll(async () => db.close())

describe('households', () => {
  it('refuses to create a second household (E_HOUSEHOLD_EXISTS)', async () => {
    const err = await db.asUser(carol, () =>
      errorOf(db.pg.query(`select create_household('Casa C', 'Carol')`)),
    )
    expect(err).toContain('E_HOUSEHOLD_EXISTS')
  })

  it('requires a signed-in caller', async () => {
    const err = await errorOf(db.pg.query(`select create_household('X', 'X')`))
    expect(err).toContain('E_NOT_AUTHENTICATED')
  })

  it('makes the creator the owner', async () => {
    const rows = await db.asUser(alice, async () =>
      (await db.pg.query<{ role: string }>(`select role from household_members`)).rows,
    )
    expect(rows).toEqual([{ role: 'owner' }])
  })
})

describe('invitations', () => {
  it('lets any member create a single-use code and a new user join with it', async () => {
    const code = await db.asUser(alice, async () =>
      (await db.pg.query<{ create_invite: string }>(`select create_invite()`)).rows[0]!.create_invite,
    )
    expect(code).toMatch(/^[0-9a-f]{20}$/)

    await db.asUser(bob, () => db.pg.query(`select join_household($1, 'Bob')`, [code]))
    const members = await db.asUser(alice, async () =>
      (await db.pg.query<{ display_name: string; role: string }>(
        `select display_name, role from household_members order by display_name`,
      )).rows,
    )
    expect(members).toEqual([
      { display_name: 'Alice', role: 'owner' },
      { display_name: 'Bob', role: 'adult' },
    ])

    // single use
    const err = await db.asUser(carol, () =>
      errorOf(db.pg.query(`select join_household($1, 'Carol')`, [code])),
    )
    expect(err).toContain('E_INVITE_INVALID')
  })

  it('lets a non-owner member invite too', async () => {
    const code = await db.asUser(bob, async () =>
      (await db.pg.query<{ create_invite: string }>(`select create_invite()`)).rows[0]!.create_invite,
    )
    expect(code).toHaveLength(20)
  })

  it('rejects an expired code', async () => {
    const code = await db.asUser(alice, async () =>
      (await db.pg.query<{ create_invite: string }>(`select create_invite()`)).rows[0]!.create_invite,
    )
    await db.asAdmin(() =>
      db.pg.query(`update household_invites set expires_at = now() - interval '1 minute' where code = $1`, [code]),
    )
    const err = await db.asUser(carol, () =>
      errorOf(db.pg.query(`select join_household($1, 'Carol')`, [code])),
    )
    expect(err).toContain('E_INVITE_INVALID')
  })

  it('rejects an unknown code and reports an existing member', async () => {
    expect(
      await db.asUser(carol, () => errorOf(db.pg.query(`select join_household('nope', 'Carol')`))),
    ).toContain('E_INVITE_INVALID')
    expect(
      await db.asUser(bob, () => errorOf(db.pg.query(`select join_household('x', 'Bob')`))),
    ).toContain('E_ALREADY_MEMBER')
  })

  it('refuses a caller outside any household (E_FORBIDDEN)', async () => {
    const err = await db.asUser(carol, () => errorOf(db.pg.query(`select create_invite()`)))
    expect(err).toContain('E_FORBIDDEN')
  })
})

describe('row level security', () => {
  it('shows a user with no membership nothing', async () => {
    await db.asAdmin(() =>
      db.pg.query(`insert into people (household_id, first_name, plan_start_date) values ($1, 'Ana', '2026-10-01')`, [householdA]),
    )
    const counts = await db.asUser(carol, async () => {
      const tables = ['households', 'household_members', 'household_invites', 'people', 'plan_terms']
      const out: Record<string, number> = {}
      for (const t of tables) {
        out[t] = (await db.pg.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]!.n
      }
      return out
    })
    expect(Object.values(counts).every((n) => n === 0)).toBe(true)
  })

  it('isolates two households from each other', async () => {
    // A second household can only exist if inserted outside the app (single-household rule).
    const dave = await db.createUser('dave@example.com')
    const householdB = await db.asAdmin(async () => {
      const h = await db.pg.query<{ id: string }>(`insert into households (name) values ('Casa B') returning id`)
      const id = h.rows[0]!.id
      await db.pg.query(`insert into household_members (household_id, user_id, role, display_name) values ($1, $2, 'owner', 'Dave')`, [id, dave])
      await db.pg.query(`insert into people (household_id, first_name, plan_start_date) values ($1, 'Zoe', '2026-10-01')`, [id])
      return id
    })
    const names = await db.asUser(dave, async () =>
      (await db.pg.query<{ first_name: string }>(`select first_name from people`)).rows.map((r) => r.first_name),
    )
    expect(names).toEqual(['Zoe'])
    const aliceSees = await db.asUser(alice, async () =>
      (await db.pg.query<{ id: string }>(`select id from households`)).rows.map((r) => r.id),
    )
    expect(aliceSees).toEqual([householdA])
    expect(aliceSees).not.toContain(householdB)
  })

  it('prevents inserting a person into another household', async () => {
    const err = await db.asUser(alice, () =>
      errorOf(db.pg.query(
        `insert into people (household_id, first_name, plan_start_date)
         select id, 'Intruder', '2026-10-01' from households where name = 'Casa B'`,
      )),
    )
    // Alice cannot even see household B, so the insert selects no row; force an explicit id instead.
    expect(err).toBeNull()
    const direct = await db.asUser(alice, async () => {
      const b = await db.asAdmin(async () => (await db.pg.query<{ id: string }>(`select id from households where name='Casa B'`)).rows[0]!.id)
      return errorOf(db.asUser(alice, () =>
        db.pg.query(`insert into people (household_id, first_name, plan_start_date) values ($1, 'Intruder', '2026-10-01')`, [b]),
      ))
    })
    expect(direct).toContain('row-level security')
  })

  it('never lets the app delete a person (deactivate only)', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`delete from people`)))
    expect(err).toContain('permission denied')
  })

  it('does not let an anonymous caller read data', async () => {
    await db.pg.exec(`reset role; set role anon;`)
    const err = await errorOf(db.pg.query(`select * from people`))
    await db.pg.exec(`reset role;`)
    expect(err).toContain('permission denied')
  })
})

describe('plan terms constraints', () => {
  let person: string
  beforeAll(async () => {
    person = await db.asAdmin(async () =>
      (await db.pg.query<{ id: string }>(`select id from people where first_name = 'Ana'`)).rows[0]!.id,
    )
  })

  const insertTerm = (cols: string, vals: string) =>
    db.asUser(alice, () =>
      errorOf(db.pg.query(`insert into plan_terms (person_id, ${cols}) values ('${person}', ${vals})`)),
    )

  it('accepts the defaults: 20 meals, Monday to Friday', async () => {
    expect(await insertTerm('effective_from', `'2026-10-01'`)).toBeNull()
    const row = await db.asUser(alice, async () =>
      (await db.pg.query<{ meals_per_month: number; delivery_weekdays: number[] }>(
        `select meals_per_month, delivery_weekdays from plan_terms`,
      )).rows[0],
    )
    expect(row).toEqual({ meals_per_month: 20, delivery_weekdays: [1, 2, 3, 4, 5] })
  })

  it('requires effective_from to be the first day of a month', async () => {
    expect(await insertTerm('effective_from', `'2026-11-15'`)).toContain('check')
  })

  it('requires meals_per_month > 0', async () => {
    expect(await insertTerm('effective_from, meals_per_month', `'2026-12-01', 0`)).toContain('check')
  })

  it('requires weekdays within 1..7', async () => {
    expect(await insertTerm('effective_from, delivery_weekdays', `'2026-12-01', '{1,8}'`)).toContain('check')
  })

  it('allows only one term per person and start month', async () => {
    expect(await insertTerm('effective_from', `'2026-10-01'`)).toContain('unique')
  })
})
