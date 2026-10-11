import os
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Beats Music API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory song catalog & event storage for instant local dev
SONGS_DB = [
    {
        "id": "song-khalifa-1",
        "title": "Burj Khalifa",
        "artist": "Shashi & Dj Khushi",
        "film": "Laxmii",
        "genre": "hindi",
        "language": "Hindi",
        "duration": 187,
        "thumbnail_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80",
        "play_count": 1420,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    },
    {
        "id": "song-jimikki-2",
        "title": "Jimikki Kammal",
        "artist": "Vineeth Sreenivasan",
        "film": "Velipadinte Pusthakam",
        "genre": "malayalam",
        "language": "Malayalam",
        "duration": 202,
        "thumbnail_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80",
        "play_count": 2890,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    },
    {
        "id": "song-hukum-3",
        "title": "Hukum - Thalaivar Alappara",
        "artist": "Anirudh Ravichander",
        "film": "Jailer",
        "genre": "tamil",
        "language": "Tamil",
        "duration": 218,
        "thumbnail_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80",
        "play_count": 5310,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    },
    {
        "id": "song-starboy-4",
        "title": "Starboy",
        "artist": "The Weeknd ft. Daft Punk",
        "film": "Starboy",
        "genre": "english",
        "language": "English",
        "duration": 230,
        "thumbnail_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80",
        "play_count": 8940,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    },
    {
        "id": "song-phonk-5",
        "title": "Metamorphosis",
        "artist": "INTERWORLD",
        "film": "Drift Phonk Vol. 1",
        "genre": "phonk",
        "language": "English",
        "duration": 143,
        "thumbnail_url": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80",
        "play_count": 6720,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    },
    {
        "id": "song-mix-6",
        "title": "Neon Nights (Cyber Mix)",
        "artist": "Kavinsky & Gesaffelstein",
        "film": "OutRun Beats",
        "genre": "mix",
        "language": "Instrumental",
        "duration": 195,
        "thumbnail_url": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80",
        "play_count": 3120,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    },
    {
        "id": "song-malayalam-7",
        "title": "Manavalan Thug",
        "artist": "Dabzee & SA",
        "film": "Thallumaala",
        "genre": "malayalam",
        "language": "Malayalam",
        "duration": 175,
        "thumbnail_url": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&auto=format&fit=crop&q=80",
        "play_count": 4210,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    },
    {
        "id": "song-tamil-8",
        "title": "Naa Ready",
        "artist": "Anirudh & Vijay",
        "film": "Leo",
        "genre": "tamil",
        "language": "Tamil",
        "duration": 248,
        "thumbnail_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&auto=format&fit=crop&q=80",
        "play_count": 7810,
        "status": "available",
        "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    },
]

USERS_DB: Dict[str, Dict[str, Any]] = {}
PLAY_EVENTS: List[Dict[str, Any]] = []

class UserPayload(BaseModel):
    user_id: str
    name: str

class PlayEventPayload(BaseModel):
    user_id: str
    song_id: str
    genre: str
    completed: bool
    skipped_at_pct: Optional[float] = None
    source: Optional[str] = "browse"

@app.get("/health")
def health():
    return {"status": "ok", "service": "beats-api", "version": "2.0.0"}

@app.get("/api/songs")
def get_songs(genre: Optional[str] = None, limit: int = 20):
    songs = SONGS_DB
    if genre and genre != "all":
        songs = [s for s in songs if s["genre"].lower() == genre.lower()]
    return {"songs": songs[:limit]}

@app.get("/api/search")
def search(q: str = Query(..., min_length=1), limit: int = 20):
    query = q.lower().strip()
    matched = [
        s for s in SONGS_DB
        if query in s["title"].lower()
        or query in s["artist"].lower()
        or (s.get("film") and query in s["film"].lower())
        or query in s["genre"].lower()
    ]
    return {"songs": matched[:limit]}

@app.get("/api/resolve/{song_id}")
def resolve_song(song_id: str):
    song = next((s for s in SONGS_DB if s["id"] == song_id), None)
    if not song:
        return {
            "stream_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "title": "Beats Audio Track",
            "artist": "Beats Artist",
        }
    return {
        "stream_url": song.get("stream_url", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"),
        "title": song["title"],
        "artist": song["artist"],
    }

@app.post("/api/invalidate/{song_id}")
def invalidate_song(song_id: str):
    return {"status": "invalidated", "song_id": song_id}

@app.get("/api/trending")
def get_trending(genre: Optional[str] = None):
    songs = SONGS_DB
    if genre and genre != "all":
        songs = [s for s in songs if s["genre"].lower() == genre.lower()]
    sorted_songs = sorted(songs, key=lambda s: s["play_count"], reverse=True)
    return {"songs": sorted_songs}

@app.get("/api/recommendations")
def get_recommendations(user_id: Optional[str] = None, limit: int = 20):
    return {"songs": SONGS_DB[:limit]}

@app.post("/api/user")
def create_or_update_user(payload: UserPayload):
    user = USERS_DB.get(payload.user_id, {
        "id": payload.user_id,
        "name": payload.name,
        "play_count": 0,
        "taste_profile": "Loves high-energy southern beats and synthwave phonk."
    })
    user["name"] = payload.name
    USERS_DB[payload.user_id] = user
    return user

@app.get("/api/user/{user_id}")
def get_user(user_id: str):
    if user_id in USERS_DB:
        return USERS_DB[user_id]
    return {
        "id": user_id,
        "name": "Anonymous",
        "play_count": len([e for e in PLAY_EVENTS if e["user_id"] == user_id]),
        "taste_profile": "Diverse explorer of electronic, Indian cinema, and phonk."
    }

@app.post("/api/play-event")
def record_play_event(payload: PlayEventPayload):
    now = datetime.now()
    event = {
        "user_id": payload.user_id,
        "song_id": payload.song_id,
        "genre": payload.genre,
        "completed": payload.completed,
        "skipped_at_pct": payload.skipped_at_pct,
        "source": payload.source,
        "played_at": now.isoformat(),
        "day_of_week": now.weekday(),  # 0=Mon, 6=Sun
        "hour_of_day": now.hour,
    }
    PLAY_EVENTS.append(event)
    return {"status": "recorded"}

@app.get("/api/user/{user_id}/stats")
def get_user_stats(user_id: str):
    """
    Returns play event data for dashboard:
    total_songs, total_hours, top_genres, top_artists, heatmap
    """
    events = [e for e in PLAY_EVENTS if e["user_id"] == user_id]
    total_songs = len(events) if len(events) > 0 else 18
    total_duration_sec = 0

    genre_counts: Dict[str, int] = {}
    artist_counts: Dict[str, int] = {}
    heatmap: Dict[str, List[int]] = {str(d): [0] * 24 for d in range(7)}

    # Base realistic listening distribution
    heatmap["0"][18] = 4; heatmap["0"][19] = 6; heatmap["0"][20] = 7
    heatmap["1"][9] = 2;  heatmap["1"][21] = 5; heatmap["1"][22] = 8
    heatmap["2"][14] = 3; heatmap["2"][20] = 6; heatmap["2"][21] = 7
    heatmap["3"][17] = 4; heatmap["3"][18] = 5; heatmap["3"][19] = 7
    heatmap["4"][20] = 8; heatmap["4"][21] = 9; heatmap["4"][22] = 10
    heatmap["5"][15] = 4; heatmap["5"][21] = 8; heatmap["5"][23] = 9
    heatmap["6"][11] = 3; heatmap["6"][16] = 5; heatmap["6"][20] = 6

    if events:
        for ev in events:
            song = next((s for s in SONGS_DB if s["id"] == ev["song_id"]), None)
            duration = song["duration"] if song else 200
            total_duration_sec += duration

            genre = ev.get("genre") or (song["genre"] if song else "mix")
            genre_counts[genre] = genre_counts.get(genre, 0) + 1

            artist = song["artist"] if song else "Various Artists"
            artist_counts[artist] = artist_counts.get(artist, 0) + 1

            dow = ev.get("day_of_week")
            hod = ev.get("hour_of_day")
            if dow is not None and hod is not None:
                d_idx = int(dow)
                h_idx = int(hod)
                if 0 <= d_idx < 7 and 0 <= h_idx < 24:
                    heatmap[str(d_idx)][h_idx] += 1
    else:
        # Default distribution for demo
        genre_counts = {"malayalam": 8, "tamil": 5, "hindi": 3, "english": 2}
        artist_counts = {
            "Anirudh Ravichander": 6,
            "Vineeth Sreenivasan": 4,
            "The Weeknd": 3,
            "Dabzee": 3,
            "INTERWORLD": 2,
        }
        total_duration_sec = total_songs * 195

    total_hours = round(total_duration_sec / 3600.0, 1)

    top_genres = []
    for g, count in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
        pct = round((count / total_songs) * 100) if total_songs > 0 else 0
        top_genres.append({"genre": g, "count": count, "pct": pct})

    top_artists = []
    for a, count in sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
        top_artists.append({"artist": a, "count": count})

    return {
        "total_songs": total_songs,
        "total_hours": total_hours,
        "top_genres": top_genres,
        "top_artists": top_artists,
        "heatmap": heatmap,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
