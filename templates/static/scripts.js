function closeModal() {
    $('#descriptionModal').modal('hide');
}

async function sendText() {
    const text = document.getElementById('textInput').value;
    const response = await fetch('http://127.0.0.1:5000/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });
    const tags = await response.json();
    displayTags(tags);
}

function displayTags(tags) {
    const outputDiv = document.getElementById('tagsOutput');
    outputDiv.innerHTML = '';
    tags.forEach((tag, index) => {
        const similarity = tag.similarity;
        if (similarity !== undefined) { // Check if similarity is defined
            const hue = 240 - (similarity - 0.8) * 1200; // 线性插值从红色到蓝色
            const color = `hsl(${hue}, 30%, 70%)`;
            const tagElement = document.createElement('div');
            tagElement.className = 'tag animate';
            tagElement.style.backgroundColor = color;
            tagElement.textContent = `${tag.tag} (Similarity: ${similarity.toFixed(2)})`;
            tagElement.onclick = () => showDescription(tag.description);
            tagElement.ondblclick = () => showDescription(tag.description);
            outputDiv.appendChild(tagElement);
        } else {
            console.error('Similarity is undefined for tag:', tag);
        }
    });
}

function showDescription(description) {
    $('#modalDescription').text(description);
    $('#descriptionModal').modal('show');
}

async function getDataPractice() {
    const response = await fetch('http://127.0.0.1:5000/get_data_practice');
    const data = await response.json();
    document.getElementById('textInput').value = data;
}

async function getNews() {
    const response = await fetch('http://127.0.0.1:5000/get_news');
    const data = await response.json();
    document.getElementById('textInput').value = data;
}

async function getLabel() {
    const response = await fetch('http://127.0.0.1:5000/get_label');
    const data = await response.json();
    document.getElementById('textInput').value = JSON.stringify(data, null, 2);
}

async function calculateDataPractice() {
    const text = document.getElementById('textInput').value;
    const response = await fetch('http://127.0.0.1:5000/calculate_with_data_practice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });
    const tags = await response.json();
    displayTags(tags);
}

function filterTags() {
    const outputDiv = document.getElementById('tagsOutput');
    const tags = Array.from(outputDiv.children);
    const threshold = 0.5; // Adjust this threshold as needed
    tags.forEach(tag => {
        const similarity = parseFloat(tag.textContent.match(/Similarity: (\d+\.\d+)/)[1]);
        if (similarity < threshold) {
            tag.style.display = 'none';
        } else {
            tag.style.display = 'block';
        }
    });
}

async function generateChart() {
    const text = document.getElementById('textInput').value;
    const response = await fetch('http://127.0.0.1:5000/generate_chart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });
    const chartData = await response.json();
    renderChart(chartData);
}

function renderChart(data) {
    const chartDom = document.getElementById('chart');
    const myChart = echarts.init(chartDom);
    const option = {
        title: {
            text: 'Tag Similarity Chart'
        },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                //judge if data exist if not return empty string
                if (params.data[0] === undefined) {
                    return `${params.data.value[2]}`;
                }
                return `${params.data[2]}<br/>Similarity: ${params.data[3].toFixed(2)}`;
            }
        },
        xAxis: {
            type: 'value'
        },
        yAxis: {
            type: 'value'
        },
        series: [{
            type: 'scatter',
            data: data.map(item => {
                if (item.tag === 'Query') {
                    return {
                        value: [item.x, item.y, item.description, item.similarity],
                        symbol: 'diamond',
                        symbolSize: 15,
                        itemStyle: { color: 'red' }
                    };
                }
                return [item.x, item.y, item.tag, item.similarity];
            }),
            symbolSize: function (data) {
                return data[3] * 10;
            },
            label: {
                show: false
            }
        }]
    };
    myChart.setOption(option);
}
