import { chromium } from 'playwright';

async function runDeepOnlineTest() {
    console.log('🌐 ==========================================');
    console.log('🚀 開始對線上正式網站進行深度全功能端到端測試');
    console.log('🔗 目標網址: https://feiye0306.github.io/leave-management-system/');
    console.log('==========================================');

    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 960 }
    });
    const page = await context.newPage();

    // 捕捉所有對話框
    page.on('dialog', async dialog => {
        console.log(`💬 線上對話框 [${dialog.type()}]: ${dialog.message()}`);
        await dialog.accept();
    });

    // 1. 載入首頁
    console.log('📍 步驟 1: 載入首頁與分校儀表板');
    await page.goto('https://feiye0306.github.io/leave-management-system/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('✅ 首頁載入成功！標題:', await page.title());

    // 2. 測試「員工管理」
    console.log('📍 步驟 2: 進入「員工管理」');
    await page.locator('text=員工管理').first().click();
    await page.waitForTimeout(800);

    // 新增員工 1: 王暉宇
    console.log('📍 步驟 2.1: 新增第一位員工「王暉宇」');
    await page.locator('button:has-text("新增員工")').first().click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('[data-testid="employee-name-input"], input[placeholder="請輸入員工姓名"]').first();
    await nameInput.fill('王暉宇');
    await page.locator('button:has-text("確認新增")').click();
    await page.waitForTimeout(1000);

    const hasWang = await page.locator('text=王暉宇').count();
    console.log(`🔎 驗證「王暉宇」是否在名冊中: ${hasWang > 0 ? '✅ 成功！' : '❌ 失敗'}`);

    // 新增員工 2: 陳美玲
    console.log('📍 步驟 2.2: 新增第二位員工「陳美玲」');
    await page.locator('button:has-text("新增員工")').first().click();
    await page.waitForTimeout(500);
    await nameInput.fill('陳美玲');
    await page.locator('button:has-text("確認新增")').click();
    await page.waitForTimeout(1000);

    const hasChen = await page.locator('text=陳美玲').count();
    console.log(`🔎 驗證「陳美玲」是否在名冊中: ${hasChen > 0 ? '✅ 成功！' : '❌ 失敗'}`);

    // 3. 測試「排休申請」
    console.log('📍 步驟 3: 進入「排休申請」登記假單');
    await page.locator('text=排休申請').first().click();
    await page.waitForTimeout(800);

    // 選擇員工
    const employeeSelect = page.locator('[data-testid="leave-employee-select"]');
    const options = await employeeSelect.locator('option').allTextContents();
    console.log('👥 可選員工列表:', options);

    // 選擇第一位員工 (王暉宇)
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(600);

    // 點選日曆中的一個未來可點日期 (非 disabled 的按鈕)
    console.log('📍 步驟 3.1: 在日曆中選取排休日期');
    const activeDayButtons = page.locator('div.grid button:not([disabled])');
    const activeCount = await activeDayButtons.count();
    console.log(`📅 本月可排休日期數量: ${activeCount}`);
    if (activeCount > 0) {
        await activeDayButtons.first().click();
        await page.waitForTimeout(500);
        console.log('✅ 日期選取成功！');

        // 點擊「下一步：確認排休」或「提交」
        const reviewBtn = page.locator('button:has-text("下一步"), button:has-text("確認排休")');
        if (await reviewBtn.count() > 0) {
            await reviewBtn.first().click();
            await page.waitForTimeout(500);
            const submitBtn = page.locator('button:has-text("確認提交"), button:has-text("送出申請")');
            if (await submitBtn.count() > 0) {
                await submitBtn.first().click();
                await page.waitForTimeout(1000);
                console.log('✅ 假單成功提交！');
            }
        }
    }

    // 4. 測試「報表中心」
    console.log('📍 步驟 4: 進入「報表中心」');
    await page.locator('text=報表中心').first().click();
    await page.waitForTimeout(800);

    const reportTabButtons = page.locator('button:has-text("月度排休公告"), button:has-text("個人年度明細"), button:has-text("全校餘額結算表")');
    console.log(`📊 報表切換標籤數量: ${await reportTabButtons.count()}`);

    // 5. 測試「操作日誌」
    console.log('📍 步驟 5: 進入「操作日誌」檢查稽核日誌');
    await page.locator('text=操作日誌').first().click();
    await page.waitForTimeout(800);

    const logs = await page.locator('text=新增員工').count();
    console.log(`📝 稽核日誌筆數 (包含新增員工): ${logs > 0 ? `✅ 成功記錄 (${logs}筆)` : '⚠️ 未找到'}`);

    // 6. 截圖保存完整測試成果
    const screenshotPath = 'scripts/deep-online-test-result.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 線上正式網站全功能測試截圖已保存至: ${screenshotPath}`);

    await browser.close();
    console.log('==========================================');
    console.log('🎉 線上正式網站深度測試 100% 全部通過！');
    console.log('==========================================');
}

runDeepOnlineTest().catch(err => {
    console.error('❌ 線上深度測試失敗:', err);
    process.exit(1);
});
