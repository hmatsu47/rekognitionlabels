function addFilePath(obj) {
    obj.resultList.forEach(element => {
        element.filename = './images/' + element.filename;
    });
}

function getLabelsFromDB(obj) {
    axios
        .post('http://127.0.0.1/app/get_labels', {numof : 100})
        .then(res => {obj.labelSelector = res.data.labels;
            self.selected = [];
        })
        .catch(err => alert('Get Labels Failed.'));
}

function getDataFromDB(obj) {
    axios
    .post('http://127.0.0.1/app/get_data', {numof : 100})
    .then(res => {obj.resultList = res.data.documents;
        addFilePath(obj);
    })
    .catch(err => alert('Get Data Failed.'));
}

function selectDataFromDB(obj) {
    axios
    .post('http://127.0.0.1/app/select_data', {numof : 100, labels: obj.selected})
    .then(res => {obj.resultList = res.data.documents;
        addFilePath(obj);
    })
    .catch(err => alert('Select Data Failed.'));
}

function uploadImageToDB(obj) {
    let formData = new FormData();
    formData.append('imageFile', obj.uploadFile);
    let config = {
        headers: {
            'content-type': 'multipart/form-data'
        }
    };
    axios
        .post('http://127.0.0.1/app/upload_image', formData, config)
        .then(res => {
            getLabelsFromDB(obj);
            getDataFromDB(obj);
            alert('Upload Succeeded.');
        })
        .catch(err => alert('Upload Failed.'));

    }

(function(){
    new Vue({
        el: '#app',
        data: {
            uploadFile: null,
            labelSelector: {},
            selected: {},
            resultList: {}
        },
        created: function() {
            getLabelsFromDB(this);
            getDataFromDB(this);
        },
        methods: {
            selectedFile: function(e) {
                e.preventDefault();
                let files = e.target.files;
                this.uploadFile = files[0];
            },
            upload: function() {
                uploadImageToDB(this);
            },
            resetData: function() {
                getLabelsFromDB(this);
                getDataFromDB(this);
            },
            selectData: function() {
                selectDataFromDB(this);
            }
        }
    });
})();