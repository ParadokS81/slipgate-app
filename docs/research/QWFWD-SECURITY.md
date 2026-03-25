# QWFWD Security Research: Preventing Traffic Tunneling Abuse

**Date:** 2026-03-25
**Context:** Conversation with oddjob (QW server admin) about why server admins are reluctant to run QWFWD publicly. The DE/NL quake.world proxies were shut down after the wirequake exploit was published.
**Goal:** Propose solutions that let QWFWD only relay legitimate QuakeWorld traffic, so server admins can safely run public proxies again.

---

## The Problem

[QWFWD](https://github.com/QW-Group/qwfwd) is a QuakeWorld UDP proxy that gives players better routing to game servers. It's critical infrastructure for competitive QW — players in South America, Asia, or Eastern Europe often need a proxy to get playable latency to EU/NA servers.

[wirequake](https://github.com/osm/wirequake) is a ~300-line Go proof-of-concept that tunnels arbitrary traffic (demonstrated with WireGuard VPN) through QWFWD. The server admin's IP becomes the VPN exit node — meaning their IP shows up if someone routes illegal traffic through it.

**This is why admins shut down their proxies or restrict them to whitelisted IPs only.** The QW community loses a piece of infrastructure that's hard to replace.

## How the Exploit Works

### QWFWD's Two Phases

**Phase 1 — Handshake (validated):**
1. Client sends `\xff\xff\xff\xff getchallenge\n`
2. QWFWD responds with a random challenge number
3. Client sends `\xff\xff\xff\xff connect 28 <qport> <challenge> "\prx\target:port"` — QWFWD validates the protocol version (28), challenge, userinfo format, and extracts the `prx` key to know where to forward
4. QWFWD connects to the target, relays the handshake, target accepts

**Phase 2 — Data forwarding (NOT validated):**
Once the peer reaches `ps_connected` state, QWFWD does this:

```c
// client → server: raw forward, no inspection
if (p->ps >= ps_connected)
    NET_SendPacket(p->s, net_message.cursize, net_message.data, &p->to);

// server → client: raw forward, no inspection
if (p->ps >= ps_connected)
    NET_SendPacket(net_socket, net_message.cursize, net_message.data, &p->from);
```

**Zero content inspection.** The only post-handshake check is a literal string match for the `drop` disconnect command.

### What wirequake Does

1. **Entry node** performs a legitimate QW handshake with QWFWD, using `prx` to point at the exit node
2. **Exit node** pretends to be a QW server — responds to `getchallenge` and `connect` properly
3. Once QWFWD enters blind-relay mode, both sides send **raw WireGuard packets** — no QW framing at all
4. QWFWD faithfully relays every byte because it was designed to be transparent
5. Supports proxy chaining via QWFWD's native `@` separator (`prx=exit:port@hop2:port`)

**wirequake doesn't disguise traffic as QW packets. It doesn't need to. QWFWD simply doesn't check.**

## What Makes QW Traffic Identifiable

QW packets have very specific, verifiable characteristics:

### Out-of-Band (Connectionless) Packets
- **Header:** `0xFFFFFFFF` (4 bytes) followed by a single-byte command (`c`, `j`, `k`, `l`, `n`, etc.)
- Only used during handshake and for pings — not during gameplay

### Connected (In-Game) Packets
- **8-byte netchan header:**
  - Bytes 0-3: Outgoing sequence number (31 bits) + reliable bit (MSB)
  - Bytes 4-7: Incoming sequence number (31 bits) + reliable ack bit (MSB)
  - (Client packets also have a 16-bit qport at bytes 8-9)
- **Sequence numbers strictly increment** — each packet has a higher sequence than the last
- **Both sides maintain synchronized counters** — the incoming_sequence in one direction matches outgoing_sequence in the other
- **Typical sizes:** 20-200 bytes for movement, up to 1450 bytes for level loads

### Traffic Patterns
- **Tick rate:** ~77 packets/sec during gameplay (13ms interval)
- **Packet sizes:** Mostly 40-200 bytes, occasionally up to 1450
- **Bidirectional:** Both client and server send regularly
- **Max MTU:** 1450 bytes hard limit in the protocol

### What Arbitrary Tunneled Traffic Looks Like
- Random byte patterns in the first 8 bytes (no valid netchan header)
- No incrementing sequence numbers
- Packet sizes can be anything (WireGuard uses ~148-byte keepalives, variable data)
- Burst patterns don't match QW's steady tick rate

---

## Solution Proposals

### Proposal 1: Netchan Header Validation (Recommended)

**Concept:** After handshake, validate that every forwarded packet has a structurally valid QW netchan header with correctly incrementing sequence numbers.

**What to check per packet:**
1. **Minimum size:** Connected QW packets are at least 10 bytes (8-byte header + 2-byte qport for client→server) or 8 bytes (server→client)
2. **Sequence number progression:** Extract the 31-bit outgoing sequence from bytes 0-3. It must be greater than the last seen sequence for this peer. Allow small gaps (packet loss) but reject backwards jumps or huge leaps (>1000).
3. **Incoming ack validity:** Bytes 4-7 contain the incoming_acknowledged sequence. It must not exceed the last outgoing sequence sent in the other direction.
4. **qport consistency:** For client→server packets, bytes 8-9 must match the qport from the original `connect` handshake.

**Implementation sketch (in `peer.c`):**

```c
// Add to peer_t struct:
uint32_t last_cl_seq;      // last outgoing sequence from client
uint32_t last_sv_seq;      // last outgoing sequence from server
uint16_t expected_qport;   // qport from connect handshake

// In client→server forwarding path:
if (p->ps >= ps_connected && !connectionless) {
    if (net_message.cursize < 10) goto drop_packet;

    uint32_t seq = LittleLong(*(uint32_t*)net_message.data) & 0x7FFFFFFF;
    uint16_t qport = LittleShort(*(uint16_t*)(net_message.data + 8));

    if (qport != p->expected_qport) goto drop_packet;
    if (seq <= p->last_cl_seq && p->last_cl_seq != 0) goto drop_packet;
    if (seq > p->last_cl_seq + 1000) goto drop_packet;  // sanity bound

    p->last_cl_seq = seq;
    NET_SendPacket(p->s, net_message.cursize, net_message.data, &p->to);
}
```

**Latency impact:** Near zero. Two integer comparisons per packet — no allocation, no hashing, no syscalls.

**What it stops:** wirequake immediately. Raw WireGuard packets will never have valid incrementing 31-bit sequence numbers in the right byte positions with a matching qport.

**What it doesn't stop:** A determined attacker who wraps tunneled data inside fake netchan headers with incrementing sequences. But this requires rewriting wirequake to be much more sophisticated, and the next proposals address that.

**Risk:** Packet reordering could cause false drops. QW already handles this (clients/servers discard out-of-order packets), so QWFWD dropping them too is consistent behavior. The `seq > last + 1000` bound is generous enough for any real network condition.

---

### Proposal 2: Traffic Pattern Analysis (Statistical)

**Concept:** Monitor per-peer traffic statistics and flag/disconnect peers whose traffic doesn't look like a QW game session.

**Metrics to track:**
1. **Packet rate:** QW runs at ~77 ticks/sec. Flag peers sustaining >150 pps or <10 pps for extended periods
2. **Average packet size:** QW gameplay averages 60-200 bytes. VPN traffic is typically larger and more variable
3. **Size variance:** QW packets cluster around a few sizes (movement frames are consistent). Tunneled traffic has high size variance
4. **Silence periods:** Real QW connections send packets continuously. Long gaps followed by bursts suggest tunneling
5. **Session duration:** QW matches last 10-30 minutes. A connection lasting 24+ hours is suspicious

**Implementation sketch:**

```c
// Add to peer_t:
uint32_t pkt_count;
uint64_t byte_count;
time_t   window_start;
uint32_t window_pkts;
uint32_t size_buckets[8];  // 0-64, 64-128, 128-256, ...

// Every N seconds, evaluate:
float pps = window_pkts / elapsed;
float avg_size = byte_count / pkt_count;
float variance = compute_size_variance(size_buckets);

if (pps > 200 || avg_size > 800 || variance > threshold)
    p->ps = ps_drop;  // or log + rate-limit
```

**Latency impact:** Zero per-packet (just counter increments). Evaluation runs on a timer, not per-packet.

**What it stops:** Sustained VPN/tunnel traffic that doesn't match QW patterns. Even if headers are faked, the overall traffic shape will differ.

**What it doesn't stop:** Low-bandwidth tunneling that stays within QW-like parameters. But that's also low-risk — you can't run a useful VPN at 77 packets/sec of 200 bytes each.

**Risk:** False positives during spectating (lower packet rate), large map downloads (sustained high bandwidth), or unusual network conditions. Needs careful threshold tuning. Best deployed as a warning/logging system first, with auto-disconnect as an opt-in for paranoid admins.

---

### Proposal 3: Periodic Re-Validation (Heartbeat Challenge)

**Concept:** Periodically send a QW-protocol challenge to the connected client. A real QW client will respond correctly; a tunnel endpoint won't.

**How it works:**
1. Every 30-60 seconds, QWFWD injects a connectionless packet to the client: `\xff\xff\xff\xff status` or a custom `\xff\xff\xff\xff qwfwd_ping <nonce>`
2. A real ezQuake client will respond with a status response or ignore unknown commands gracefully
3. A tunnel endpoint (wirequake) will either not respond or forward the packet to WireGuard, which won't produce a valid QW response
4. If no valid response within 5 seconds, disconnect the peer

**Latency impact:** None on game traffic. The challenge is a separate connectionless packet on a 30-60 second interval.

**What it stops:** Any tunnel that doesn't implement a full QW client protocol stack. wirequake would need to intercept and respond to these challenges, requiring significant QW protocol knowledge.

**What it doesn't stop:** An attacker who adds a QW protocol responder to their tunnel. But the arms race cost goes up significantly.

**Risk:** This requires cooperation from QW clients. The `status` command is already handled by ezQuake, but a custom command would need client-side support. Could be implemented as a `qwfwd_ping` extension that modern ezQuake versions opt into.

**Complication:** QWFWD currently doesn't inject packets into the stream — it only relays. This would be a new capability. Also, connectionless packets from the proxy IP might confuse clients if they don't expect them.

---

### Proposal 4: Protocol-Aware Payload Validation (Deep Inspection)

**Concept:** Beyond header validation, inspect the first few bytes of the payload to verify it contains valid QW commands.

**What to check:**
- **Client→Server packets** start with (after netchan header + qport):
  - `clc_move` (0x03): Player movement — most common, has predictable structure
  - `clc_stringcmd` (0x04): Console command string
  - `clc_delta` (0x05): Delta state request
  - `clc_tmove` (0x06): Teleport move
  - `clc_upload` (0x07): File upload chunk
- **Server→Client packets** start with (after netchan header):
  - `svc_*` commands (0x00-0x50+): Entity updates, sound, print, etc.
  - Most common: `svc_packetentities` (0x30), `svc_playerinfo` (0x31), `svc_nails` (0x32)

**Implementation sketch:**

```c
// For client→server packets:
uint8_t cmd = net_message.data[10];  // first byte after header+qport
if (cmd != clc_move && cmd != clc_stringcmd && cmd != clc_delta
    && cmd != clc_tmove && cmd != clc_upload)
    goto drop_packet;
```

**Latency impact:** Negligible — one byte comparison.

**What it stops:** Any tunneled data where the byte at position 10 doesn't happen to be a valid QW command. This is ~98% of random data.

**Risk:** **High.** This is fragile and version-dependent. Protocol extensions (FTE, MVD) add new commands. Reliable message framing can shift the command byte position. Compressed or encrypted payloads (some modern QW extensions) would fail validation. **Not recommended as a standalone solution** — too many edge cases. Better as an optional hardening layer on top of Proposal 1.

---

### Proposal 5: Destination Validation via Server Query

**Concept:** Before completing a proxy connection, verify that the target is actually a QW server by querying it independently.

**How it works:**
1. Client sends `connect` with `prx=target:port`
2. Before creating the peer, QWFWD sends an independent `\xff\xff\xff\xff status` query to `target:port`
3. A real QW server responds with `\xff\xff\xff\xff n\...` containing server info (map, players, etc.)
4. If no valid QW server response within 2 seconds, reject the connection
5. Optionally cache results (server X was verified 5 minutes ago, skip re-query)

**Latency impact:** Adds 1 RTT (typically <50ms) to connection setup only. Zero impact on ongoing game traffic.

**What it stops:** wirequake exit nodes that don't implement QW server query responses. The exit node currently only handles `getchallenge` and `connect` — it doesn't respond to `status` queries.

**What it doesn't stop:** An exit node that also implements `status` response. But again, raises the bar.

**Risk:** Low. This is a connection-time check, not per-packet. False positives could occur if a QW server is temporarily unresponsive, but a 2-second timeout with retry is generous. Could also query master servers to verify the target is a known registered QW server.

---

## Red Team Analysis

We tested our own proposals by playing attacker. Here's what held up and what didn't.

### Proposal 2 (Status Query): Broken on Arrival

The exit node is fully attacker-controlled. Faking a QW server status response is ~30 lines of code:

```python
if data[:4] == b'\xff\xff\xff\xff' and b'status' in data[4:]:
    response = b'\xff\xff\xff\xffn\\\\hostname\\QuakeWorld Server\\map\\dm4\\maxclients\\16\\n'
    sock.sendto(response, addr)
```

The exit node can handle both status queries and tunnel traffic on the same UDP port by inspecting the first few bytes. **This proposal adds almost zero security by itself.**

### Proposal 1 (Netchan Validation): Raises the Bar, but Beatable

An attacker modifies wirequake to wrap tunnel data in valid netchan headers:

```
For each tunneled packet:
  Bytes 0-3: ++local_sequence (incrementing)
  Bytes 4-7: last_received_remote_sequence (valid ack)
  Bytes 8-9: original_qport (from handshake)
  Bytes 10+: tunneled payload
```

**Effort:** ~50-80 lines of Go. A weekend project. Performance impact: negligible (~10 bytes overhead per packet).

The header-only check can't distinguish "valid netchan with game data" from "valid netchan with VPN data" because the payload is opaque binary either way.

**However:** This does kill current wirequake out of the box, and it forces future variants to maintain proper netchan state — which is a meaningful increase in complexity.

### What the Red Team Recommends Instead

| Combination | Bypass Difficulty | Why |
|-------------|-------------------|-----|
| Proposals 1 + 2 | Moderate (weekend) | Status faking is trivial, netchan wrapping is doable |
| **Proposal 1 + Hub allowlist** | **High** | Attacker needs netchan wrapping AND a machine running a real QW server |
| **Proposal 1 + bandwidth caps** | **High for VPN use** | QW uses ~15-25 KB/s up, ~60 KB/s down. VPN is useless at those rates |
| **Proposal 1 + traffic patterns + bandwidth caps** | **Very high** | Multiple independent signals must all be faked simultaneously |

### Key Insight: Allowlisting > Server Query

Instead of asking "is this target a QW server?" (easily faked), ask "is this target a *known* QW server?" Cross-reference against the QW Hub server list (Supabase) or QW master servers. This turns oddjob's manual IP whitelist into an automated, community-maintained one.

The attacker would need to either:
- Compromise a machine already running a QW server, or
- Register a fake server with master servers (detectable, and masters can be curated)

### Bandwidth Caps: The Underrated Defense

Real QW traffic has hard physical limits:
- **Client→Server:** ~15-25 KB/s (movement commands at ~77Hz)
- **Server→Client:** ~30-60 KB/s (entity updates, unreliable)
- **A VPN tunnel needs:** 1-10+ MB/s to be useful

Cap per-connection bandwidth to 100 KB/s (generous for QW, useless for VPN) and tunneling becomes impractical. This doesn't prevent it — but it makes the tunnel too slow to be worth the effort.

---

## Revised Recommendation

The original Proposals 1+2 were overconfident. Here's the updated layered defense:

| Layer | What | Stops | Cost | Priority |
|-------|------|-------|------|----------|
| **1** | Netchan header validation | Raw tunneling (wirequake as-is) | ~0 latency, ~50 LOC | Must-have |
| **2** | Hub server allowlist | Fake exit nodes (no fake responder needed) | 1 query at connect, ~100 LOC | Must-have |
| **3** | Per-connection bandwidth cap (~100 KB/s) | Makes VPN tunneling useless | ~30 LOC | Strongly recommended |
| **4** | Traffic pattern analysis | Sophisticated header-wrapping variants | ~100 LOC | Recommended |
| **5** | Periodic re-validation (heartbeat) | Persistent advanced attacks | Needs client support | Future / optional |
| ~~6~~ | ~~Status query to target~~ | ~~Nothing useful~~ | ~~Trivially bypassed~~ | ~~Removed~~ |
| ~~7~~ | ~~Deep payload inspection~~ | ~~Marginal~~ | ~~Fragile, breaks extensions~~ | ~~Removed~~ |

**Layers 1 + 2 + 3 together** would make QWFWD tunneling impractical for any real-world abuse scenario. An attacker would need to: maintain netchan state, target a known QW server's machine, AND accept ~100 KB/s throughput. At that point, buying a $3/month VPS is vastly easier.

## Realistic Threat Assessment

Before implementing anything, it's worth asking: **how realistic is this threat?**

The wirequake exploit was written by slime — a grey-hat hacker who did it because it was fun and clever, not because he needed a VPN. As oddjob put it: "if it ain't fun he ain't doing shit." It's a proof of concept, not a criminal tool.

**Could someone actually use QWFWD for illegal traffic anonymization?** In theory, yes. In practice, consider the alternatives available to someone with genuinely criminal intent:

- **Mullvad VPN** requires no name, no email, no identity. You get an account number. That's it.
- Multiple VPN providers accept cryptocurrency or prepaid gift cards bought with cash
- You can sign up from any public WiFi
- You get gigabit speeds for a few dollars a month
- There are dozens of providers competing specifically on anonymity as a selling point

Meanwhile, a QWFWD tunnel gives you ~100 KB/s through a niche game proxy with ~30 active users worldwide. The idea that a motivated criminal would choose this over a 5-minute anonymous VPN signup doesn't hold up as a practical threat model.

| Threat | Likelihood | Impact |
|--------|-----------|--------|
| Skilled criminal uses QWFWD for illegal traffic | Extremely low — vastly better tools exist | High if it happens |
| Script kiddie runs wirequake for laughs | Low — tiny community, niche tool | Low |
| The PoC's existence scares admins into shutting down proxies | **Already happened** | **High — community loses critical infrastructure** |

**The actual damage isn't from criminals using QWFWD — it's from the *fear* of it causing admins to shut down their proxies.** The perception of risk killed the DE/NL proxies, not actual abuse.

### What About Connection Logging?

Connection logging (writing client IPs to a log file) was considered but has significant limitations:

- **It's reactive, not preventive** — your IP still shows up at the destination. Law enforcement still traces it to you. You still get the knock on your door. The logs help you prove innocence *after* the fact, but you've already been raided.
- **Logs are self-authored records** — their evidentiary value can be questioned.
- **The attacker's "origin IP" may itself be a VPN** — so the logs may lead nowhere.
- **It doesn't embed in the traffic** — the destination never sees the real source IP, only the QWFWD admin's IP.

Logging is good operational practice, but it's damage control, not a defense.

### The Honest Conclusion

The realistic risk of QWFWD tunnel abuse is very low — anonymous VPNs are cheap, easy to get, and orders of magnitude more capable than a game proxy tunnel. But server admins are volunteers running infrastructure on their own hardware. They shouldn't have to accept *any* risk for free community service, even a theoretical one.

The technical mitigations (netchan validation + bandwidth caps + traffic patterns) make QWFWD technically useless as a tunnel, closing the theoretical vulnerability that caused the DE/NL shutdowns. Combined with the practical reality that better anonymization tools are trivially available, admins should be able to run public QWFWD with confidence.

### Open Questions for the Community

This research was done by AI with guidance from a QW community member, not by network security specialists. People with deeper expertise in network security, UDP protocol design, or proxy architecture may identify angles we missed or better approaches entirely. Some open questions:

- **Could QWFWD be redesigned as a connection broker** (NAT hole-punching) rather than a packet relay, removing it from the data path entirely? What would the latency tradeoffs be?
- **Are there established patterns from other game proxy systems** (e.g., Valve's SDR, Riot's relay infrastructure) that solve this differently?
- **Is there a cryptographic approach** — e.g., QWFWD signs a session token that the destination server verifies, proving the traffic originated from a legitimate QW handshake?
- **Would a UDP-level equivalent of the PROXY protocol** (origin IP embedded at the transport layer) be feasible without breaking existing QW servers?

Feedback welcome from: qqshka (QWFWD maintainer), slime (wirequake author / security perspective), tykling (network security), or anyone else with relevant expertise.

---

## Implementation Notes

- QWFWD is ~6800 LOC of C, single-threaded `select()`-based event loop
- All packet handling is in `peer.c` — the forwarding paths are clearly marked
- The `peer_t` struct already tracks qport and state — adding sequence counters is trivial
- Changes should be behind a cvar (e.g., `set validate_traffic 1`) so admins can opt in
- The existing whitelist feature remains useful as a manual override on top of the Hub allowlist
- Hub allowlist could be fetched periodically (every 5-10 min) from QW Hub API or master server queries
- Bandwidth tracking is just bytes-per-second counters on the existing `peer_t` struct

## References

- [QWFWD source](https://github.com/QW-Group/qwfwd) — `peer.c` lines 255-340 (forwarding), `svc.c` lines 70-325 (handshake)
- [wirequake](https://github.com/osm/wirequake) — `internal/entry/entry.go`, `internal/exit/exit.go`, `internal/qw/qw.go`
- [ezquake-source](https://github.com/QW-Group/ezquake-source) — `net_chan.c` (netchan implementation), `cl_parse.c` / `sv_user.c` (command types)
- [mvdsv](https://github.com/QW-Group/mvdsv) — `net_chan.c`, `sv_main.c` (server-side protocol handling)
