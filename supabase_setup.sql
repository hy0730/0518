-- Supabase SQL Editor에 붙여넣어 실행하세요.

-- 1) 테이블 생성
create table if not exists public.regions (
  id text primary key,
  data jsonb not null
);

-- 2) Realtime용 설정 (UPDATE payload에 row 전체가 오도록)
alter table public.regions replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.regions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- 3) (권장) RLS + 읽기 정책(클라이언트 anon key로 select 가능)
alter table public.regions enable row level security;
drop policy if exists "public read regions" on public.regions;
create policy "public read regions" on public.regions
for select
to anon
using (true);

-- 4) 초기 데이터 upsert (id = 'anyang')
insert into public.regions (id, data)
values (
  'anyang',
  $${
  "region": {
    "id": "anyang",
    "name": "안양"
  },
  "assets": {
    "mainBackground": "/assets/anyang/bg_main.jpg",
    "mapBackground": "/assets/anyang/bg_map.jpg"
  },
  "map": {
    "nodes": [
      {
        "id": "node_guseo_office",
        "title": "구서이면사무소",
        "icon": "/assets/anyang/nodes/guseo.png",
        "position": { "x": 28, "y": 22 },
        "dialogId": "dlg_guseo_office"
      },
      {
        "id": "node_seoksu_dolmen",
        "title": "석수동 지석묘",
        "icon": "/assets/anyang/nodes/dolmen.png",
        "position": { "x": 68, "y": 26 },
        "dialogId": "dlg_seoksu_dolmen"
      },
      {
        "id": "node_manan_bridge",
        "title": "만안교",
        "icon": "/assets/anyang/nodes/bridge.png",
        "position": { "x": 18, "y": 52 },
        "dialogId": "dlg_manan_bridge"
      },
      {
        "id": "node_sammaksa",
        "title": "삼막사",
        "icon": "/assets/anyang/nodes/temple.png",
        "position": { "x": 42, "y": 58 },
        "dialogId": "dlg_sammaksa"
      },
      {
        "id": "node_jungchosa",
        "title": "중초사지 당간지주",
        "icon": "/assets/anyang/nodes/jungchosa.png",
        "position": { "x": 58, "y": 74 },
        "dialogId": "dlg_jungchosa"
      },
      {
        "id": "node_anyang_stream",
        "title": "안양천",
        "icon": "/assets/anyang/nodes/stream.png",
        "position": { "x": 84, "y": 80 },
        "dialogId": "dlg_anyang_stream"
      }
    ]
  },
  "dialogs": {
    "dlg_guseo_office": {
      "id": "dlg_guseo_office",
      "title": "구서면사무소",
      "steps": [
        {
          "type": "text",
          "speaker": "해설",
          "text": "여기는 ‘구서면사무소’야. 안양의 옛 행정 중심지로, 지역 행정의 흔적을 보여주는 중요한 장소지."
        },
        {
          "type": "quiz",
          "quiz": {
            "type": "multipleChoice",
            "id": "quiz_guseo_1",
            "prompt": "구서면사무소가 상징하는 의미로 가장 알맞은 것은?",
            "options": [
              { "id": "a", "label": "옛 행정의 중심지" },
              { "id": "b", "label": "해상 무역의 거점" },
              { "id": "c", "label": "왕실의 별궁" }
            ],
            "correctOptionId": "a",
            "feedbackCorrect": "정답! 행정 기능이 모인 중심지였어.",
            "feedbackWrong": "아쉬워! 행정의 중심지라는 점이 핵심이야."
          }
        },
        { "type": "end" }
      ]
    },

    "dlg_seoksu_dolmen": {
      "id": "dlg_seoksu_dolmen",
      "title": "석수동 지석묘",
      "steps": [
        {
          "type": "text",
          "speaker": "해설",
          "text": "이 고인돌은 남방식의 특징을 띠고 있어 북방식 고인돌과는 다르단다."
        },
        {
          "type": "quiz",
          "quiz": {
            "type": "multipleChoice",
            "id": "quiz_dolmen_1",
            "prompt": "대사에 따르면 석수동 지석묘는 어떤 양식의 특징을 띤다고 했을까?",
            "options": [
              { "id": "a", "label": "북방식" },
              { "id": "b", "label": "남방식" },
              { "id": "c", "label": "해양식" }
            ],
            "correctOptionId": "b",
            "feedbackCorrect": "맞아! 남방식 특징을 띤다고 했지.",
            "feedbackWrong": "힌트: ‘남방식’이라는 단어가 그대로 나왔어."
          }
        },
        { "type": "end" }
      ]
    },

    "dlg_manan_bridge": {
      "id": "dlg_manan_bridge",
      "title": "만안교",
      "steps": [
        {
          "type": "text",
          "speaker": "해설",
          "text": "만안교는 옛 길목을 잇던 다리로, 사람들이 오가며 지역의 생활사를 형성한 장소야."
        },
        {
          "type": "quiz",
          "quiz": {
            "type": "multipleChoice",
            "id": "quiz_bridge_1",
            "prompt": "만안교가 주로 담당한 역할로 가장 알맞은 것은?",
            "options": [
              { "id": "a", "label": "사람과 길목을 잇는 통행" },
              { "id": "b", "label": "성벽 방어" },
              { "id": "c", "label": "관측 천문대" }
            ],
            "correctOptionId": "a"
          }
        },
        { "type": "end" }
      ]
    },

    "dlg_sammaksa": {
      "id": "dlg_sammaksa",
      "title": "삼막사",
      "steps": [
        {
          "type": "text",
          "speaker": "해설",
          "text": "삼막사는 산과 함께 이어져 온 신앙과 수행의 장소로, 지역 문화의 결을 남기고 있어."
        },
        {
          "type": "quiz",
          "quiz": {
            "type": "multipleChoice",
            "id": "quiz_sammaksa_1",
            "prompt": "삼막사의 성격을 가장 잘 설명하는 것은?",
            "options": [
              { "id": "a", "label": "신앙과 수행의 장소" },
              { "id": "b", "label": "왕실의 사냥터" },
              { "id": "c", "label": "현대식 경기장" }
            ],
            "correctOptionId": "a"
          }
        },
        { "type": "end" }
      ]
    },

    "dlg_jungchosa": {
      "id": "dlg_jungchosa",
      "title": "중초사지 당간지주",
      "steps": [
        {
          "type": "text",
          "speaker": "해설",
          "text": "여기는 중초사지 당간지주야. 절에서 큰 의식 때 세우던 ‘당(幢)’이라는 깃발을 걸기 위한 기둥이지."
        },
        {
          "type": "quiz",
          "quiz": {
            "type": "multipleChoice",
            "id": "quiz_jungchosa_1",
            "prompt": "중초사지 당간지주에는 ‘서기 827년에 건립’되었다는 명문 기록이 전해진다. 건립 연도로 맞는 것은?",
            "options": [
              { "id": "a", "label": "서기 727년" },
              { "id": "b", "label": "서기 827년" },
              { "id": "c", "label": "서기 927년" }
            ],
            "correctOptionId": "b",
            "feedbackCorrect": "정답! 명문 기록에 따르면 서기 827년에 건립되었다고 해.",
            "feedbackWrong": "아쉬워! 힌트: ‘827년’이 핵심이야."
          }
        },
        { "type": "end" }
      ]
    },

    "dlg_anyang_stream": {
      "id": "dlg_anyang_stream",
      "title": "안양천",
      "steps": [
        {
          "type": "text",
          "speaker": "해설",
          "text": "안양천은 도시의 흐름을 따라 삶과 산업, 여가의 층위가 겹쳐진 공간이야."
        },
        {
          "type": "quiz",
          "quiz": {
            "type": "multipleChoice",
            "id": "quiz_stream_1",
            "prompt": "안양천 설명으로 알맞은 것은?",
            "options": [
              { "id": "a", "label": "삶과 여가의 층위가 겹친 공간" },
              { "id": "b", "label": "바다 위의 항로" },
              { "id": "c", "label": "사막의 오아시스" }
            ],
            "correctOptionId": "a"
          }
        },
        { "type": "end" }
      ]
    }
  }
}$$::jsonb
)
on conflict (id) do update
set data = excluded.data;

