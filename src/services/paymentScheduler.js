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

    // 빠른 테스트용 - 매 2분마다 실행
    startQuickTest() {
        const task = cron.schedule('*/2 * * * *', async () => {
            if (this.isRunning) {
                console.log('⚡ Quick test auto payment is already running, skipping...');
                return;
            }

            this.isRunning = true;
            const currentTime = new Date().toLocaleString('ko-KR');
            
            console.log('\n' + '='.repeat(60));
            console.log('⚡ QUICK TEST - Starting 2-minute auto payment test');
            console.log('📅 Execution Time:', currentTime);
            console.log('🔄 Test Run #' + Math.floor(Date.now() / 1000));
            console.log('='.repeat(60));

            try {
                const result = await paymentService.executeAutoPay();
                
                console.log('\n' + '✅ QUICK TEST RESULTS:');
                console.log('📊 Summary:', result.summary);
                
                if (result.details) {
                    console.log('💰 Payment Details:');
                    result.details.forEach((detail, index) => {
                        console.log(`   ${index + 1}. ${detail}`);
                    });
                }
                
                console.log('⏰ Next execution in 2 minutes...');
                console.log('=' .repeat(60) + '\n');
                
            } catch (error) {
                console.log('\n' + '❌ QUICK TEST ERROR:');
                console.error('💥 Error Message:', error.message);
                if (error.stack) {
                    console.error('📋 Stack Trace:', error.stack);
                }
                console.log('🔄 Will retry in 2 minutes...');
                console.log('='.repeat(60) + '\n');
            } finally {
                this.isRunning = false;
            }
        });

        this.scheduledTasks.push(task);
        
        console.log('\n' + '🚀 QUICK TEST SCHEDULER STARTED!');
        console.log('⚡ Frequency: Every 2 minutes');
        console.log('🕐 First execution: ' + new Date(Date.now() + 2 * 60 * 1000).toLocaleString('ko-KR'));
        console.log('⏹️  To stop: call paymentScheduler.stopAll()');
        console.log('📊 To check status: call paymentScheduler.getStatus()');
        console.log('='.repeat(60) + '\n');
    }

    // 수동 실행
    async runManually() {
        if (this.isRunning) {
            throw new Error('Auto payment is already running');
        }

        this.isRunning = true;
        console.log('\n' + '🔧 MANUAL EXECUTION STARTED');
        console.log('📅 Time:', new Date().toLocaleString('ko-KR'));
        console.log('-'.repeat(40));

        try {
            const result = await paymentService.executeAutoPay();
            
            console.log('✅ Manual auto payment completed!');
            console.log('📊 Summary:', result.summary);
            
            if (result.details) {
                console.log('💰 Payment Details:');
                result.details.forEach((detail, index) => {
                    console.log(`   ${index + 1}. ${detail}`);
                });
            }
            
            console.log('-'.repeat(40) + '\n');
            return result;
            
        } catch (error) {
            console.error('❌ Manual execution failed:', error.message);
            throw error;
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
        console.log('\n' + '⏹️  ALL SCHEDULERS STOPPED');
        console.log('📊 Stopped tasks: ' + this.scheduledTasks.length);
        console.log('✅ Ready for new scheduling\n');
    }

    // 현재 상태 확인
    getStatus() {
        const status = {
            isRunning: this.isRunning,
            activeTasks: this.scheduledTasks.length,
            nextExecution: this.scheduledTasks.length > 0 ? 'Scheduled' : 'No active schedules',
            currentTime: new Date().toLocaleString('ko-KR')
        };

        console.log('\n' + '📊 PAYMENT SCHEDULER STATUS:');
        console.log('🔄 Currently Running:', status.isRunning ? '✅ YES' : '❌ NO');
        console.log('📋 Active Tasks:', status.activeTasks);
        console.log('⏰ Schedule Status:', status.nextExecution);
        console.log('🕐 Current Time:', status.currentTime);
        console.log('-'.repeat(40) + '\n');

        return status;
    }
}

module.exports = new PaymentScheduler();