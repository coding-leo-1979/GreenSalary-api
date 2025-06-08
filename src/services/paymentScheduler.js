// src/services/paymentScheduler.js

const cron = require('node-cron');
const paymentService = require('./paymentService');

class PaymentScheduler {
    constructor() {
        this.isRunning = false;
        this.scheduledTasks = [];
    }

    // 매일 오전 9시에 자동 지급 실행
    startDailySchedule() {
        const task = cron.schedule('0 9 * * *', async () => {
            if (this.isRunning) {
                console.log('⏰ Auto payment is already running, skipping...');
                return;
            }

            this.isRunning = true;
            console.log('🚀 Starting scheduled auto payment...');
            console.log('📅 Time:', new Date().toLocaleString('ko-KR'));

            try {
                const result = await paymentService.executeAutoPay();
                console.log('✅ Scheduled auto payment completed:', result.summary);
            } catch (error) {
                console.error('❌ Scheduled auto payment failed:', error.message);
            } finally {
                this.isRunning = false;
            }
        }, {
            timezone: "Asia/Seoul"
        });

        this.scheduledTasks.push(task);
        console.log('⏰ Payment scheduler started - Daily execution at 9:00 AM KST');
    }

    // 테스트용 - 매 30분마다 실행
    startTestSchedule() {
        const task = cron.schedule('*/30 * * * *', async () => {
            if (this.isRunning) {
                console.log('⏰ Test auto payment is already running, skipping...');
                return;
            }

            this.isRunning = true;
            console.log('🧪 Starting test auto payment...');
            console.log('📅 Time:', new Date().toLocaleString('ko-KR'));

            try {
                const result = await paymentService.executeAutoPay();
                console.log('✅ Test auto payment completed:', result.summary);
            } catch (error) {
                console.error('❌ Test auto payment failed:', error.message);
            } finally {
                this.isRunning = false;
            }
        });

        this.scheduledTasks.push(task);
        console.log('⏰ Test payment scheduler started - Every 30 minutes');
    }

    // 수동 실행
    async runManually() {
        if (this.isRunning) {
            throw new Error('Auto payment is already running');
        }

        this.isRunning = true;
        console.log('🔧 Starting manual auto payment...');

        try {
            const result = await paymentService.executeAutoPay();
            console.log('✅ Manual auto payment completed:', result.summary);
            return result;
        } finally {
            this.isRunning = false;
        }
    }

    // 스케줄러 중지
    stopAll() {
        this.scheduledTasks.forEach(task => {
            task.stop();
        });
        this.scheduledTasks = [];
        console.log('⏹️ All payment schedulers stopped');
    }

    // 현재 상태 확인
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeTasks: this.scheduledTasks.length,
            nextExecution: this.scheduledTasks.length > 0 ? 'Scheduled' : 'No active schedules'
        };
    }
}

module.exports = new PaymentScheduler();