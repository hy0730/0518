export async function preloadImages(urls: string[]): Promise<void> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  await Promise.all(
    uniqueUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();

          img.onload = () => resolve();
          img.onerror = () => resolve(); // 실패해도 "완료"로 간주(로딩 흐름이 멈추지 않게)

          img.src = url;
        })
    )
  );
}
