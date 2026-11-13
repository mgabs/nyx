describe('News', () => {
    const newsSelector = 'div.news-section.news-section--expanded';

    it('should display news', async () => {
        await backgroundUtils.setNews([{
            id: 'some',
            date: new Date().toISOString(),
            url: '/',
            headline: 'Test news',
        }]);

        await new Promise((resolve) => setTimeout(resolve, 900));
        expect(await popupUtils.exists(newsSelector)).toBe(true);
    });
});
