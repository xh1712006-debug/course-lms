const { parentPort, workerData } = require('worker_threads');
const tf = require('@tensorflow/tfjs');

/**
 * Worker Thread chạy huấn luyện mô hình CNN 1D bằng TensorFlow.js dưới nền
 */
async function trainModel() {
  const { trainData, valData, epochs, learningRate, batchSize, seed } = workerData;

  try {
    // 1. Cố định Random Seed để đảm bảo tính tái lập (Reproducibility)
    const activeSeed = seed || 42;

    // 2. Định dạng cấu trúc dữ liệu đầu vào Tensor
    // Do đặc tả chuỗi thời gian có 50 bước, dữ liệu đầu vào CNN 1D cần định dạng 3D: [BatchSize, Steps, Channels]
    const trainX = tf.tensor3d(trainData.map(d => d.features.map(f => [f])), [trainData.length, 50, 1]);
    // One-hot encoded nhãn phân loại (kích thước 2: [Không_hoạt_động, Hoạt_động])
    const trainY = tf.tensor2d(trainData.map(d => d.label === 1 ? [0, 1] : [1, 0]), [trainData.length, 2]);

    const valX = tf.tensor3d(valData.map(d => d.features.map(f => [f])), [valData.length, 50, 1]);
    const valY = tf.tensor2d(valData.map(d => d.label === 1 ? [0, 1] : [1, 0]), [valData.length, 2]);

    // 3. [RS-ALGO-01] Thiết kế mô hình CNN 1D với các lớp Batch Normalization
    const model = tf.sequential();

    // Lớp Tích chập Convolution 1D thứ nhất
    model.add(tf.layers.conv1d({
      inputShape: [50, 1],
      filters: 8,
      kernelSize: 3,
      strides: 1,
      padding: 'same',
      kernelInitializer: tf.initializers.glorotNormal({ seed: activeSeed }),
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) // Chuẩn hóa L2 phạt trọng số lớn
    }));
    // Lớp Batch Normalization ngay sau tích chập để ổn định số học và tăng tốc độ hội tụ
    model.add(tf.layers.batchNormalization({ axis: -1 }));
    model.add(tf.layers.reLU());
    model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2 }));

    // Lớp Tích chập Convolution 1D thứ hai
    model.add(tf.layers.conv1d({
      filters: 16,
      kernelSize: 3,
      strides: 1,
      padding: 'same',
      kernelInitializer: tf.initializers.glorotNormal({ seed: activeSeed + 1 }),
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
    }));
    model.add(tf.layers.batchNormalization({ axis: -1 }));
    model.add(tf.layers.reLU());
    model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2 }));

    // Lớp Flatten & Dense kết nối đầy đủ
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelInitializer: tf.initializers.glorotNormal({ seed: activeSeed + 2 }),
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
    }));
    
    // Lớp đầu ra Softmax cho 2 lớp phân loại
    model.add(tf.layers.dense({
      units: 2,
      activation: 'softmax',
      kernelInitializer: tf.initializers.glorotNormal({ seed: activeSeed + 3 })
    }));

    // 4. [RS-ALGO-02] Biên dịch mô hình sử dụng Adam Optimizer
    // Sử dụng hằng số bảo vệ epsilon nhỏ để tránh lỗi số học NaN (Numerical Stability)
    model.compile({
      optimizer: tf.train.adam(learningRate, 0.9, 0.999, 1e-8),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // 5. Khởi chạy quá trình Huấn luyện & Phát sự kiện cập nhật Epoch
    await model.fit(trainX, trainY, {
      epochs: epochs,
      batchSize: batchSize,
      validationData: [valX, valY],
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          // Gửi kết quả sau mỗi epoch về luồng chính
          parentPort.postMessage({
            type: 'progress',
            epoch: epoch + 1,
            loss: Math.round(logs.loss * 100000) / 100000,
            accuracy: Math.round(logs.acc * 10000) / 100, // Đổi sang %
            val_loss: Math.round(logs.val_loss * 100000) / 100000,
            val_acc: Math.round(logs.val_acc * 10000) / 100 // Đổi sang %
          });
        }
      }
    });

    // 6. Đánh giá kiểm định cuối cùng và lưu trọng số mô hình
    const evalResult = model.evaluate(valX, valY);
    const finalLoss = evalResult[0].dataSync()[0];
    const finalAcc = evalResult[1].dataSync()[0];

    // Tạo thư mục lưu trữ nếu chưa có
    const fs = require('fs');
    const path = require('path');
    const modelDir = path.join(__dirname, 'model-output');
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    // Tuần tự hóa mô hình (Model Serialization) bằng Save Handler tự viết thông qua fs
    await model.save(tf.io.withSaveHandler(async (modelArtifacts) => {
      // 1. Lưu file model.json (kiến trúc & weight specs)
      const modelJson = {
        modelTopology: modelArtifacts.modelTopology,
        weightsManifest: [{
          paths: ['./weights.bin'],
          weights: modelArtifacts.weightSpecs
        }]
      };
      fs.writeFileSync(path.join(modelDir, 'model.json'), JSON.stringify(modelJson, null, 2), 'utf8');

      // 2. Lưu file weights.bin (dữ liệu trọng số dạng nhị phân)
      if (modelArtifacts.weightData) {
        const buffer = Buffer.from(modelArtifacts.weightData);
        fs.writeFileSync(path.join(modelDir, 'weights.bin'), buffer);
      }
      return { modelArtifactsInfo: { dateSaved: new Date().toISOString() } };
    }));

    // Dọn dẹp Tensors giải phóng bộ nhớ RAM/VRAM tránh rò rỉ bộ nhớ
    tf.dispose([trainX, trainY, valX, valY, model]);

    // Gửi thông báo hoàn tất về luồng chính
    parentPort.postMessage({
      type: 'done',
      loss: Math.round(finalLoss * 100000) / 100000,
      accuracy: Math.round(finalAcc * 10000) / 100,
      modelPath: modelDir
    });

  } catch (err) {
    console.error('[Worker Train Error]', err);
    parentPort.postMessage({
      type: 'error',
      error: err.message
    });
  }
}

// Chạy hàm huấn luyện mô hình
trainModel();
