'use client';

import React, { useState } from "react";
import { db, storage, auth } from "../lib/firebase";
import { addDoc, collection, Timestamp, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { useCollection } from "react-firebase-hooks/firestore";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

// Google Maps APIキー
const GOOGLE_MAPS_API_KEY = "AIzaSyD_f3fUCg9IrFSEVpo70p0EPCZv-l_pOHk";

type Fields = {
  location: string;
  comment: string;
  lat: string;
  lng: string;
};

export default function Home() {
  const [user] = useAuthState(auth);

  const [image, setImage] = useState<File | null>(null);
  const [fields, setFields] = useState<Fields>({
    location: "",
    comment: "",
    lat: "",
    lng: ""
  });
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ lat: 35.170915, lng: 136.881537 });

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  if (!isLoaded) return <div>地図を読み込み中...</div>;

  // 地図クリックでピン＆緯度経度セット
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setFields((f) => ({
        ...f,
        lat: lat.toString(),
        lng: lng.toString(),
      }));
      setMapCenter({ lat, lng });
    }
  };

  // 現在地ピン
  const setCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("位置情報取得がサポートされていません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFields((f) => ({
          ...f,
          lat: lat.toString(),
          lng: lng.toString(),
        }));
        setMapCenter({ lat, lng });
      },
      () => {
        alert("現在地が取得できませんでした");
      }
    );
  };

  // 型注釈を追加！
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields({ ...fields, [e.target.name]: e.target.value });
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImage(e.target.files && e.target.files[0] ? e.target.files[0] : null);
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!image) return alert("画像を選んでください");
    if (!fields.lat || !fields.lng) return alert("地図をクリックまたは現在地ボタンで場所を選んでください");
    const fileRef = ref(storage, `inephotos/${Date.now()}_${image.name}`);
    await uploadBytes(fileRef, image);
    const url = await getDownloadURL(fileRef);
    await addDoc(collection(db, "posts"), {
      ...fields,
      lat: fields.lat,
      lng: fields.lng,
      imageUrl: url,
      createdAt: Timestamp.now(),
      user: user?.displayName ?? "",
    });
    alert("投稿しました！");
    setFields({ location: "", comment: "", lat: "", lng: "" });
    setImage(null);
  };

  const signIn = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };
  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>全国稲生育マップ（仮）</h1>
      {user ? (
        <div style={styles.userBox}>
          <p>こんにちは、{user.displayName}さん</p>
          <button style={styles.signBtn} onClick={signOutUser}>サインアウト</button>
        </div>
      ) : (
        <button style={styles.signBtn} onClick={signIn}>Googleでログイン</button>
      )}

      {/* 地図（ピン設置用） */}
      <button type="button" style={styles.geoBtn} onClick={setCurrentLocation}>
        現在地にピンを立てる
      </button>
      <div style={styles.mapWrap}>
        <GoogleMap
          mapContainerStyle={styles.mapContainer}
          center={fields.lat && fields.lng ? { lat: parseFloat(fields.lat), lng: parseFloat(fields.lng) } : mapCenter}
          zoom={fields.lat && fields.lng ? 15 : 10}
          onClick={handleMapClick}
        >
          {fields.lat && fields.lng && (
            <Marker position={{ lat: parseFloat(fields.lat), lng: parseFloat(fields.lng) }} />
          )}
        </GoogleMap>
      </div>

      {/* 投稿フォーム（ログイン後のみ） */}
      {user && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <input type="file" onChange={handleFile} required style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <input
              type="text"
              name="location"
              value={fields.location}
              onChange={handleChange}
              placeholder="場所名（任意）"
              style={styles.input}
            />
          </div>
          <div style={{ ...styles.formGroup, display: "flex", gap: 8 }}>
            <input
              type="text"
              name="lat"
              value={fields.lat}
              onChange={handleChange}
              placeholder="緯度"
              readOnly
              required
              style={{ ...styles.input, flex: 1 }}
            />
            <input
              type="text"
              name="lng"
              value={fields.lng}
              onChange={handleChange}
              placeholder="経度"
              readOnly
              required
              style={{ ...styles.input, flex: 1 }}
            />
          </div>
          <div style={styles.formGroup}>
            <textarea
              name="comment"
              value={fields.comment}
              onChange={handleChange}
              placeholder="コメント"
              style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
            />
          </div>
          <button type="submit" style={styles.postBtn}>投稿する</button>
        </form>
      )}

      {/* 地図で一覧 */}
      <hr style={styles.hr} />
      <h2 style={styles.subtitle}>地図で見る投稿一覧</h2>
      <MapPosts />

      {/* 投稿一覧 */}
      <hr style={styles.hr} />
      <h2 style={styles.subtitle}>みんなの投稿一覧</h2>
      <ListPosts />
    </div>
  );
}

// 投稿一覧
function ListPosts() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const [snapshots, loading, error] = useCollection(q);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error.message}</div>;
  if (!snapshots?.docs?.length) return <div>投稿はまだありません。</div>;

  return (
    <div>
      {snapshots.docs.map((doc) => {
        const d = doc.data() as any;
        return (
          <div key={doc.id} style={styles.card}>
            <img src={d.imageUrl} alt="" style={styles.cardImg} />
            <div style={styles.cardRow}>場所：{d.location}</div>
            <div style={styles.cardRow}>緯度：{d.lat}／経度：{d.lng}</div>
            <div style={styles.cardRow}>コメント：{d.comment}</div>
            <div style={styles.cardRow}>投稿者：{d.user}</div>
            <div style={styles.cardRow}>日時：{d.createdAt?.toDate().toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

// 地図で投稿一覧（ピン全部表示）
function MapPosts() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const [snapshots, loading, error] = useCollection(q);

  if (loading) return <div>投稿を取得中...</div>;
  if (error) return <div>エラー: {error.message}</div>;
  if (!snapshots?.docs?.length) return <div>投稿はまだありません。</div>;

  return (
    <div style={styles.mapWrap}>
      <GoogleMap
        mapContainerStyle={styles.mapContainerLarge}
        center={{ lat: 35.170915, lng: 136.881537 }}
        zoom={7}
      >
        {snapshots.docs.map((doc) => {
          const d = doc.data() as any;
          if (!d.lat || !d.lng) return null;
          return (
            <Marker
              key={doc.id}
              position={{ lat: parseFloat(d.lat), lng: parseFloat(d.lng) }}
              title={d.location}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
}

// インラインCSS
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: 12,
    fontFamily: "'Noto Sans JP', sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  title: {
    fontSize: 24,
    margin: "16px 0 8px",
    textAlign: "center",
    fontWeight: 700,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 18,
    margin: "18px 0 8px",
    fontWeight: 600,
    textAlign: "center",
  },
  hr: {
    margin: "28px 0 18px",
    border: 0,
    borderTop: "1px solid #cbd5e1",
  },
  userBox: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  signBtn: { fontSize: 16, padding: "8px 18px", borderRadius: 5, background: "#2563eb", color: "#fff", border: "none" },
  geoBtn: { margin: "8px 0", padding: "8px 18px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 5, fontSize: 15 },
  form: { marginTop: 10 },
  formGroup: { marginBottom: 12 },
  input: { width: "100%", fontSize: 16, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff" },
  postBtn: { width: "100%", fontSize: 18, padding: "13px 0", borderRadius: 8, background: "#16a34a", color: "#fff", border: "none", marginTop: 10 },
  mapWrap: { width: "100%", maxWidth: 440, margin: "0 auto", borderRadius: 10, overflow: "hidden" },
  mapContainer: { width: "100%", height: "220px" },
  mapContainerLarge: { width: "100%", height: "320px" },
  card: { background: "#fff", borderRadius: 12, padding: 14, marginBottom: 22, boxShadow: "0 2px 8px #ddd" },
  cardImg: { width: "100%", maxWidth: 340, borderRadius: 8, marginBottom: 10 },
  cardRow: { fontSize: 15, marginBottom: 2 },
};
