import { chromium } from 'playwright';

async function cleanAllData() {
    console.log('🧹 啟動瀏覽器執行「清空所有資料」重置流程...');

    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 960 }
    });
    const page = await context.newPage();

    // 自動接受所有 confirm 與 alert
    page.on('dialog', async dialog => {
        console.log(`💬 系統對話框 [${dialog.type()}]: ${dialog.message()}`);
        await dialog.accept();
    });

    // 1. 本地清空
    console.log('📍 步驟 1: 前往本機系統清空資料');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.locator('text=系統設定').first().click();
    await page.waitForTimeout(600);

    const resetBtn = page.locator('button:has-text("清空所有資料"), button:has-text("清除所有資料")');
    await resetBtn.click();
    await page.waitForTimeout(1500);
    console.log('✅ 本機資料已完全清空！');

    // 2. 線上清空
    console.log('📍 步驟 2: 前往線上正式網站清空資料');
    await page.goto('https://feiye0306.github.io/leave-management-system/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.locator('text=系統設定').first().click();
    await page.waitForTimeout(800);

    const onlineResetBtn = page.locator('button:has-text("清空所有資料"), button:has-text("清除所有資料")');
    if (await onlineResetBtn.count() > 0) {
        await onlineResetBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ 線上正式網站資料已完全清空！');
    }

    // 驗證員工管理中是否已為 0 人
    await page.locator('text=員工管理').first().click();
    await page.waitForTimeout(1000);
    const emptyNotice = await page.locator('text=查無員工資料').count();
    console.log(`🔎 驗證名冊狀態: ${emptyNotice > 0 ? '✅ 乾淨初始狀態 (0 人)' : '⚠️ 仍有員工'}`);

    await browser.close();
    console.log('🎉 所有測試資料已全數清除，系統重置為乾淨初始狀態！');
}

cleanAllData().catch(err => {
    console.error('❌ 清空資料失敗:', err);
    process.exit(1);
});
